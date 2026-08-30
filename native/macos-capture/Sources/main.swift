import AVFoundation
import CoreGraphics
import CoreMedia
import Darwin
import Foundation
import ScreenCaptureKit

private enum CaptureError: LocalizedError {
    case invalidArguments(String)
    case sourceUnavailable(String)
    case writerSetup(String)
    case writerFailed(String)
    case noVideoFrames

    var errorDescription: String? {
        switch self {
        case let .invalidArguments(message),
             let .sourceUnavailable(message),
             let .writerSetup(message),
             let .writerFailed(message):
            return message
        case .noVideoFrames:
            return "ScreenCaptureKit stopped before producing a complete video frame."
        }
    }
}

private struct DisplayHint {
    let index: Int
    let x: Double?
    let y: Double?
    let width: Double?
    let height: Double?
}

private enum CaptureTarget {
    case display(DisplayHint)
    case region(DisplayHint, CGRect)
    case window(CGWindowID)
}

private struct CaptureOptions {
    let outputURL: URL
    let target: CaptureTarget
    let width: Int
    let height: Int
    let framesPerSecond: Int
    let bitrate: Int
    let capturesSystemAudio: Bool
    let excludedBundleIdentifier: String?

    static func parse(_ arguments: [String]) throws -> CaptureOptions {
        guard arguments.first == "record" else {
            throw CaptureError.invalidArguments(
                "Usage: flowtake-macos-capture record --output <path> --width <pixels> --height <pixels> [capture target]"
            )
        }

        var values: [String: String] = [:]
        var flags = Set<String>()
        var index = 1
        while index < arguments.count {
            let argument = arguments[index]
            guard argument.hasPrefix("--") else {
                throw CaptureError.invalidArguments("Unexpected argument: \(argument)")
            }
            if argument == "--system-audio" {
                flags.insert(argument)
                index += 1
                continue
            }
            guard index + 1 < arguments.count else {
                throw CaptureError.invalidArguments("Missing value for \(argument)")
            }
            values[argument] = arguments[index + 1]
            index += 2
        }

        guard let outputPath = values["--output"], !outputPath.isEmpty else {
            throw CaptureError.invalidArguments("--output is required.")
        }
        let width = try positiveEvenInteger(values["--width"], name: "--width")
        let height = try positiveEvenInteger(values["--height"], name: "--height")
        let framesPerSecond = try integer(
            values["--fps"] ?? "30",
            name: "--fps",
            allowed: 1 ... 120
        )
        let bitrateKbps = try integer(
            values["--bitrate-kbps"] ?? "9000",
            name: "--bitrate-kbps",
            allowed: 1_000 ... 100_000
        )

        let displayHint = try DisplayHint(
            index: integer(values["--display-index"] ?? "0", name: "--display-index", allowed: 0 ... 64),
            x: optionalDouble(values["--display-x"], name: "--display-x"),
            y: optionalDouble(values["--display-y"], name: "--display-y"),
            width: optionalPositiveDouble(values["--display-width"], name: "--display-width"),
            height: optionalPositiveDouble(values["--display-height"], name: "--display-height")
        )

        let target: CaptureTarget
        if let rawWindowID = values["--window-id"] {
            guard let windowID = UInt32(rawWindowID), windowID > 0 else {
                throw CaptureError.invalidArguments("--window-id must be a positive integer.")
            }
            target = .window(windowID)
        } else if let rawRegion = values["--region-percent"] {
            let parts = rawRegion.split(separator: ",").map(String.init)
            guard parts.count == 4,
                  let x = Double(parts[0]),
                  let y = Double(parts[1]),
                  let regionWidth = Double(parts[2]),
                  let regionHeight = Double(parts[3]),
                  x.isFinite,
                  y.isFinite,
                  regionWidth.isFinite,
                  regionHeight.isFinite,
                  regionWidth > 0,
                  regionHeight > 0
            else {
                throw CaptureError.invalidArguments(
                    "--region-percent must be x,y,width,height percentages."
                )
            }
            let percentageBounds = CGRect(
                x: x.clamped(to: 0 ... 100),
                y: y.clamped(to: 0 ... 100),
                width: regionWidth.clamped(to: 0.1 ... 100),
                height: regionHeight.clamped(to: 0.1 ... 100)
            )
            target = .region(displayHint, percentageBounds)
        } else {
            target = .display(displayHint)
        }

        return CaptureOptions(
            outputURL: URL(fileURLWithPath: outputPath).standardizedFileURL,
            target: target,
            width: width,
            height: height,
            framesPerSecond: framesPerSecond,
            bitrate: bitrateKbps * 1_000,
            capturesSystemAudio: flags.contains("--system-audio"),
            excludedBundleIdentifier: values["--exclude-bundle-id"]
        )
    }

    private static func positiveEvenInteger(_ raw: String?, name: String) throws -> Int {
        let value = try integer(raw ?? "", name: name, allowed: 2 ... 16_384)
        return max(2, value - (value % 2))
    }

    private static func integer(
        _ raw: String,
        name: String,
        allowed: ClosedRange<Int>
    ) throws -> Int {
        guard let value = Int(raw), allowed.contains(value) else {
            throw CaptureError.invalidArguments(
                "\(name) must be between \(allowed.lowerBound) and \(allowed.upperBound)."
            )
        }
        return value
    }

    private static func optionalDouble(_ raw: String?, name: String) throws -> Double? {
        guard let raw else { return nil }
        guard let value = Double(raw), value.isFinite else {
            throw CaptureError.invalidArguments("\(name) must be a finite number.")
        }
        return value
    }

    private static func optionalPositiveDouble(_ raw: String?, name: String) throws -> Double? {
        guard let value = try optionalDouble(raw, name: name) else { return nil }
        guard value > 0 else {
            throw CaptureError.invalidArguments("\(name) must be positive.")
        }
        return value
    }
}

private extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

private enum StopEvent {
    case requested
    case streamFailure(Error)
}

private final class CaptureSession: NSObject, SCStreamOutput, SCStreamDelegate {
    let events: AsyncStream<StopEvent>

    private let options: CaptureOptions
    private let streamConfiguration: SCStreamConfiguration
    private let contentFilter: SCContentFilter
    private let writer: AVAssetWriter
    private let videoInput: AVAssetWriterInput
    private let audioInput: AVAssetWriterInput?
    private let partialOutputURL: URL
    private let eventContinuation: AsyncStream<StopEvent>.Continuation
    private let writerQueue = DispatchQueue(
        label: "com.flowtake.capture.writer",
        qos: .userInteractive
    )

    private var stream: SCStream?
    private var writerStarted = false
    private var readyEmitted = false
    private var firstVideoTimestamp: CMTime?
    private var completedVideoFrames = 0
    private var stopFinalized = false

    static func create(options: CaptureOptions) async throws -> CaptureSession {
        let availableContent = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: false
        )

        let filter: SCContentFilter
        let configuration = SCStreamConfiguration()
        configuration.width = options.width
        configuration.height = options.height
        configuration.minimumFrameInterval = CMTime(
            value: 1,
            timescale: CMTimeScale(options.framesPerSecond)
        )
        configuration.queueDepth = 4
        // 420v is the native VideoToolbox-friendly path. Avoiding BGRA keeps
        // 4K frame bandwidth and conversion work substantially lower.
        configuration.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        configuration.showsCursor = false
        configuration.capturesAudio = options.capturesSystemAudio
        configuration.excludesCurrentProcessAudio = true
        configuration.sampleRate = 48_000
        configuration.channelCount = 2

        switch options.target {
        case let .window(windowID):
            guard let window = availableContent.windows.first(where: { $0.windowID == windowID }) else {
                throw CaptureError.sourceUnavailable(
                    "The selected window is no longer available to ScreenCaptureKit."
                )
            }
            filter = SCContentFilter(desktopIndependentWindow: window)

        case let .display(hint):
            let display = try selectDisplay(from: availableContent.displays, hint: hint)
            filter = displayFilter(
                for: display,
                content: availableContent,
                excludedBundleIdentifier: options.excludedBundleIdentifier
            )

        case let .region(hint, percentageBounds):
            let display = try selectDisplay(from: availableContent.displays, hint: hint)
            filter = displayFilter(
                for: display,
                content: availableContent,
                excludedBundleIdentifier: options.excludedBundleIdentifier
            )
            let displayWidth = CGFloat(display.width)
            let displayHeight = CGFloat(display.height)
            let sourceRect = CGRect(
                x: displayWidth * percentageBounds.origin.x / 100,
                y: displayHeight * percentageBounds.origin.y / 100,
                width: displayWidth * percentageBounds.width / 100,
                height: displayHeight * percentageBounds.height / 100
            ).intersection(CGRect(x: 0, y: 0, width: displayWidth, height: displayHeight))
            guard sourceRect.width >= 2, sourceRect.height >= 2 else {
                throw CaptureError.sourceUnavailable(
                    "The selected capture region falls outside the display."
                )
            }
            configuration.sourceRect = sourceRect
        }

        return try CaptureSession(
            options: options,
            filter: filter,
            configuration: configuration
        )
    }

    private init(
        options: CaptureOptions,
        filter: SCContentFilter,
        configuration: SCStreamConfiguration
    ) throws {
        self.options = options
        contentFilter = filter
        streamConfiguration = configuration
        let partialURL = options.outputURL
            .deletingLastPathComponent()
            .appendingPathComponent(
                "\(options.outputURL.deletingPathExtension().lastPathComponent).native-partial.mp4"
            )
        partialOutputURL = partialURL

        var continuation: AsyncStream<StopEvent>.Continuation!
        events = AsyncStream<StopEvent> { continuation = $0 }
        eventContinuation = continuation

        let fileManager = FileManager.default
        try fileManager.createDirectory(
            at: options.outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        for staleURL in [partialURL, options.outputURL] where fileManager.fileExists(atPath: staleURL.path) {
            try fileManager.removeItem(at: staleURL)
        }

        do {
            writer = try AVAssetWriter(outputURL: partialURL, fileType: .mp4)
        } catch {
            throw CaptureError.writerSetup("Could not create the native MP4 writer: \(error.localizedDescription)")
        }

        let compressionProperties: [String: Any] = [
            AVVideoAverageBitRateKey: options.bitrate,
            AVVideoExpectedSourceFrameRateKey: options.framesPerSecond,
            AVVideoMaxKeyFrameIntervalKey: options.framesPerSecond * 2,
            AVVideoAllowFrameReorderingKey: true,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ]
        videoInput = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: options.width,
                AVVideoHeightKey: options.height,
                AVVideoCompressionPropertiesKey: compressionProperties,
            ]
        )
        videoInput.expectsMediaDataInRealTime = true
        guard writer.canAdd(videoInput) else {
            throw CaptureError.writerSetup("AVAssetWriter rejected the ScreenCaptureKit video input.")
        }
        writer.add(videoInput)

        if options.capturesSystemAudio {
            let input = AVAssetWriterInput(
                mediaType: .audio,
                outputSettings: [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: 48_000,
                    AVNumberOfChannelsKey: 2,
                    AVEncoderBitRateKey: 192_000,
                ]
            )
            input.expectsMediaDataInRealTime = true
            guard writer.canAdd(input) else {
                throw CaptureError.writerSetup("AVAssetWriter rejected the system-audio input.")
            }
            writer.add(input)
            audioInput = input
        } else {
            audioInput = nil
        }

        super.init()
    }

    func start() async throws {
        let stream = SCStream(
            filter: contentFilter,
            configuration: streamConfiguration,
            delegate: self
        )
        // A single serial queue orders every append before finalization. This
        // prevents audio/video callbacks from racing markAsFinished.
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: writerQueue)
        if options.capturesSystemAudio {
            try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: writerQueue)
        }
        self.stream = stream
        try await stream.startCapture()
    }

    func requestStop() {
        eventContinuation.yield(.requested)
    }

    func stop() async throws {
        if let stream {
            do {
                try await stream.stopCapture()
            } catch {
                emitDiagnostic(
                    event: "warning",
                    fields: ["message": "ScreenCaptureKit stop reported: \(error.localizedDescription)"],
                    to: .standardError
                )
            }
        }
        stream = nil

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            writerQueue.async {
                guard !self.stopFinalized else {
                    continuation.resume()
                    return
                }
                self.stopFinalized = true

                guard self.writerStarted, self.completedVideoFrames > 0 else {
                    self.writer.cancelWriting()
                    try? FileManager.default.removeItem(at: self.partialOutputURL)
                    continuation.resume(throwing: CaptureError.noVideoFrames)
                    return
                }

                self.videoInput.markAsFinished()
                self.audioInput?.markAsFinished()
                self.writer.finishWriting {
                    if self.writer.status == .completed {
                        do {
                            if FileManager.default.fileExists(atPath: self.options.outputURL.path) {
                                try FileManager.default.removeItem(at: self.options.outputURL)
                            }
                            try FileManager.default.moveItem(
                                at: self.partialOutputURL,
                                to: self.options.outputURL
                            )
                            continuation.resume()
                        } catch {
                            continuation.resume(
                                throwing: CaptureError.writerFailed(
                                    "Could not publish the completed native recording: \(error.localizedDescription)"
                                )
                            )
                        }
                    } else {
                        let message = self.writer.error?.localizedDescription
                            ?? "AVAssetWriter ended in state \(self.writer.status.rawValue)."
                        try? FileManager.default.removeItem(at: self.partialOutputURL)
                        continuation.resume(
                            throwing: CaptureError.writerFailed(
                                "Native recording finalization failed: \(message)"
                            )
                        )
                    }
                }
            }
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        eventContinuation.yield(.streamFailure(error))
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard sampleBuffer.isValid else { return }
        switch outputType {
        case .screen:
            guard isCompleteScreenFrame(sampleBuffer) else { return }
            let timestamp = sampleBuffer.presentationTimeStamp
            if !writerStarted {
                guard writer.startWriting() else {
                    let error = writer.error
                        ?? CaptureError.writerFailed("AVAssetWriter could not start.")
                    eventContinuation.yield(.streamFailure(error))
                    return
                }
                writer.startSession(atSourceTime: timestamp)
                firstVideoTimestamp = timestamp
                writerStarted = true
            }
            guard writer.status == .writing else { return }
            if videoInput.isReadyForMoreMediaData, videoInput.append(sampleBuffer) {
                completedVideoFrames += 1
                if !readyEmitted {
                    readyEmitted = true
                    emitDiagnostic(
                        event: "ready",
                        fields: [
                            "fps": options.framesPerSecond,
                            "height": options.height,
                            "systemAudio": options.capturesSystemAudio,
                            "width": options.width,
                        ]
                    )
                }
            }

        case .audio:
            guard let audioInput else { return }
            guard writerStarted,
                  writer.status == .writing,
                  let firstVideoTimestamp,
                  sampleBuffer.presentationTimeStamp >= firstVideoTimestamp,
                  audioInput.isReadyForMoreMediaData
            else {
                return
            }
            _ = audioInput.append(sampleBuffer)

        @unknown default:
            break
        }
    }

    private func isCompleteScreenFrame(_ sampleBuffer: CMSampleBuffer) -> Bool {
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(
            sampleBuffer,
            createIfNecessary: false
        ) as? [[SCStreamFrameInfo: Any]],
            let attachment = attachments.first,
            let statusRawValue = attachment[.status] as? Int,
            let status = SCFrameStatus(rawValue: statusRawValue)
        else {
            return false
        }
        return status == .complete
    }
}

private func selectDisplay(from displays: [SCDisplay], hint: DisplayHint) throws -> SCDisplay {
    guard !displays.isEmpty else {
        throw CaptureError.sourceUnavailable("ScreenCaptureKit reported no displays.")
    }

    if let x = hint.x,
       let y = hint.y,
       let width = hint.width,
       let height = hint.height
    {
        return displays.min { lhs, rhs in
            displayDistance(lhs, x: x, y: y, width: width, height: height)
                < displayDistance(rhs, x: x, y: y, width: width, height: height)
        } ?? displays[0]
    }

    return displays[hint.index.clamped(to: 0 ... (displays.count - 1))]
}

private func displayDistance(
    _ display: SCDisplay,
    x: Double,
    y: Double,
    width: Double,
    height: Double
) -> Double {
    let frame = display.frame
    return abs(Double(frame.origin.x) - x)
        + abs(Double(frame.origin.y) - y)
        + abs(Double(frame.width) - width)
        + abs(Double(frame.height) - height)
}

private func displayFilter(
    for display: SCDisplay,
    content: SCShareableContent,
    excludedBundleIdentifier: String?
) -> SCContentFilter {
    let excludedApplications: [SCRunningApplication]
    if let excludedBundleIdentifier {
        excludedApplications = content.applications.filter {
            $0.bundleIdentifier == excludedBundleIdentifier
        }
    } else {
        excludedApplications = []
    }
    return SCContentFilter(
        display: display,
        excludingApplications: excludedApplications,
        exceptingWindows: []
    )
}

private func errorCode(for error: Error) -> String {
    if !CGPreflightScreenCaptureAccess() {
        return "screen-permission-denied"
    }
    if error is CaptureError {
        return "capture-configuration-error"
    }
    return "native-capture-error"
}

private func emitDiagnostic(
    event: String,
    fields: [String: Any] = [:],
    to output: FileHandle = .standardOutput
) {
    var payload = fields
    payload["event"] = event
    payload["backend"] = "ScreenCaptureKit"
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
    else {
        return
    }
    output.write(data)
    output.write(Data([0x0A]))
    try? output.synchronize()
}

@main
private enum FlowtakeMacCapture {
    static func main() async {
        let arguments = Array(CommandLine.arguments.dropFirst())
        if arguments.first == "probe" {
            emitDiagnostic(
                event: "capabilities",
                fields: [
                    "minimumMacOS": "13.0",
                    "screen": true,
                    "systemAudio": true,
                    "window": true,
                ]
            )
            return
        }

        do {
            let options = try CaptureOptions.parse(arguments)
            let capture = try await CaptureSession.create(options: options)

            DispatchQueue.global(qos: .utility).async {
                while let line = readLine() {
                    let command = line.trimmingCharacters(in: .whitespacesAndNewlines)
                    if command == "q" || command == "stop" {
                        break
                    }
                }
                capture.requestStop()
            }

            try await capture.start()

            var stopFailure: Error?
            for await event in capture.events {
                switch event {
                case .requested:
                    break
                case let .streamFailure(error):
                    stopFailure = error
                }
                break
            }

            try await capture.stop()
            if let stopFailure {
                throw stopFailure
            }
            emitDiagnostic(event: "stopped", fields: ["output": options.outputURL.path])
        } catch {
            emitDiagnostic(
                event: "error",
                fields: [
                    "code": errorCode(for: error),
                    "message": error.localizedDescription,
                ],
                to: .standardError
            )
            Darwin.exit(EXIT_FAILURE)
        }
    }
}
