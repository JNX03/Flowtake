@preconcurrency import AVFoundation
import CoreMedia
import CoreVideo
import Foundation
@preconcurrency import ScreenCaptureKit

package enum CaptureRuntimeError: LocalizedError {
    case unsupportedSystem
    case displayNotFound(Int)
    case windowNotFound(UInt32)
    case systemAudioRequiresMacOS13
    case writerSetup(String)
    case writerFailed(String)
    case noVideoFrames

    package var errorDescription: String? {
        switch self {
        case .unsupportedSystem:
            return "ScreenCaptureKit requires macOS 12.3 or newer."
        case .displayNotFound(let index):
            return "Display index \(index) is not available."
        case .windowNotFound(let id):
            return "Window \(id) is no longer available."
        case .systemAudioRequiresMacOS13:
            return "Native system-audio capture requires macOS 13 or newer."
        case .writerSetup(let reason):
            return "Could not configure the native recording writer: \(reason)"
        case .writerFailed(let reason):
            return "Native recording failed: \(reason)"
        case .noVideoFrames:
            return "Native recording stopped before receiving a complete video frame."
        }
    }
}

enum StopReason: Sendable {
    case requested
    case failed(String)
}

final class StopSignal: @unchecked Sendable {
    private let stream: AsyncStream<StopReason>
    private let continuation: AsyncStream<StopReason>.Continuation

    init() {
        var capturedContinuation: AsyncStream<StopReason>.Continuation?
        stream = AsyncStream { continuation in
            capturedContinuation = continuation
        }
        continuation = capturedContinuation!
    }

    func signal(_ reason: StopReason) {
        continuation.yield(reason)
    }

    func wait() async -> StopReason {
        for await reason in stream {
            return reason
        }
        return .requested
    }
}

@available(macOS 12.3, *)
final class CaptureWriter: @unchecked Sendable {
    private let writer: AVAssetWriter
    private let videoInput: AVAssetWriterInput
    private let videoAdaptor: AVAssetWriterInputPixelBufferAdaptor
    private let audioInput: AVAssetWriterInput?
    private let cadence: FixedFrameCadence
    private let failureHandler: @Sendable (String) -> Void
    private var startedSession = false
    private var receivedVideoFrame = false
    private var failure: String?
    private var firstVideoPresentationTime: CMTime?
    private var firstVideoHostTime: CMTime?
    private var lastPixelBuffer: CVPixelBuffer?
    private var lastFrameIndex: Int64 = -1

    init(configuration: CaptureConfiguration, failureHandler: @escaping @Sendable (String) -> Void) throws {
        self.failureHandler = failureHandler

        do {
            writer = try AVAssetWriter(outputURL: configuration.outputURL, fileType: .mp4)
        } catch {
            throw CaptureRuntimeError.writerSetup(error.localizedDescription)
        }

        let compression: [String: Any] = [
            AVVideoAverageBitRateKey: configuration.bitrate,
            AVVideoExpectedSourceFrameRateKey: configuration.framesPerSecond,
            AVVideoMaxKeyFrameIntervalKey: configuration.framesPerSecond * 2,
            AVVideoAllowFrameReorderingKey: false,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
        ]
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: configuration.width,
            AVVideoHeightKey: configuration.height,
            AVVideoCompressionPropertiesKey: compression
        ]
        videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = true

        guard writer.canAdd(videoInput) else {
            throw CaptureRuntimeError.writerSetup("The H.264 video input is unavailable.")
        }
        writer.add(videoInput)
        videoAdaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoInput,
            sourcePixelBufferAttributes: nil
        )
        cadence = FixedFrameCadence(framesPerSecond: configuration.framesPerSecond)

        if configuration.capturesSystemAudio {
            let audioSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 48_000,
                AVNumberOfChannelsKey: 2,
                AVEncoderBitRateKey: 192_000
            ]
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            input.expectsMediaDataInRealTime = true
            guard writer.canAdd(input) else {
                throw CaptureRuntimeError.writerSetup("The AAC system-audio input is unavailable.")
            }
            writer.add(input)
            audioInput = input
        } else {
            audioInput = nil
        }

        writer.movieFragmentInterval = CMTime(seconds: 2, preferredTimescale: 600)
        guard writer.startWriting() else {
            throw CaptureRuntimeError.writerSetup(
                writer.error?.localizedDescription ?? "AVAssetWriter did not start."
            )
        }
    }

    func appendVideo(_ sampleBuffer: CMSampleBuffer) {
        guard failure == nil, sampleBuffer.isValid else {
            return
        }
        guard isCompleteScreenFrame(sampleBuffer) else {
            return
        }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        let hostTime = CMClockGetTime(CMClockGetHostTimeClock())
        if !startedSession {
            writer.startSession(atSourceTime: presentationTime)
            startedSession = true
            firstVideoPresentationTime = presentationTime
            firstVideoHostTime = hostTime
        }
        // ScreenCaptureKit may deliver only when pixels change. Retain its
        // newest complete frame; a real-time timer appends it at fixed cadence.
        lastPixelBuffer = pixelBuffer
        appendVideoFrames(through: hostTime)
    }

    func appendAudio(_ sampleBuffer: CMSampleBuffer) {
        guard failure == nil,
              startedSession,
              sampleBuffer.isValid,
              let audioInput,
              audioInput.isReadyForMoreMediaData
        else {
            return
        }
        if !audioInput.append(sampleBuffer) {
            fail(writer.error?.localizedDescription ?? "Could not append system audio.")
        }
    }

    func finish(atHostTime stopHostTime: CMTime) async throws {
        if let failure {
            writer.cancelWriting()
            throw CaptureRuntimeError.writerFailed(failure)
        }
        guard startedSession, receivedVideoFrame else {
            writer.cancelWriting()
            throw CaptureRuntimeError.noVideoFrames
        }

        if firstVideoHostTime != nil,
           let firstVideoPresentationTime,
           lastPixelBuffer != nil
        {
            appendVideoFrames(through: stopHostTime, waitUntilReady: true)

            let sessionEndIndex = max(lastFrameIndex + 1, 1)
            writer.endSession(
                atSourceTime: cadence.presentationTime(
                    forFrameIndex: sessionEndIndex,
                    startingAt: firstVideoPresentationTime
                )
            )
        }

        videoInput.markAsFinished()
        audioInput?.markAsFinished()
        await withCheckedContinuation { continuation in
            writer.finishWriting {
                continuation.resume()
            }
        }

        guard writer.status == .completed else {
            throw CaptureRuntimeError.writerFailed(
                writer.error?.localizedDescription ?? "AVAssetWriter did not finalize the MP4."
            )
        }
    }

    func appendVideoFrames(through hostTime: CMTime, waitUntilReady: Bool = false) {
        guard let firstVideoHostTime,
              let lastPixelBuffer
        else {
            return
        }

        let elapsedSeconds = CMTimeGetSeconds(
            CMTimeSubtract(hostTime, firstVideoHostTime)
        )
        let targetFrameIndex = cadence.frameIndex(forElapsedSeconds: elapsedSeconds)
        guard targetFrameIndex > lastFrameIndex else {
            return
        }

        for frameIndex in (lastFrameIndex + 1)...targetFrameIndex {
            guard appendVideoFrame(
                lastPixelBuffer,
                at: frameIndex,
                waitUntilReady: waitUntilReady
            ) else {
                return
            }
        }
    }

    private func appendVideoFrame(
        _ pixelBuffer: CVPixelBuffer,
        at frameIndex: Int64,
        waitUntilReady: Bool = false
    ) -> Bool {
        if waitUntilReady {
            let deadline = Date().addingTimeInterval(2)
            while !videoInput.isReadyForMoreMediaData, Date() < deadline {
                Thread.sleep(forTimeInterval: 0.002)
            }
        }
        guard videoInput.isReadyForMoreMediaData,
              let firstVideoPresentationTime
        else {
            return false
        }

        let presentationTime = cadence.presentationTime(
            forFrameIndex: frameIndex,
            startingAt: firstVideoPresentationTime
        )
        guard videoAdaptor.append(pixelBuffer, withPresentationTime: presentationTime) else {
            fail(writer.error?.localizedDescription ?? "Could not append a video frame.")
            return false
        }

        receivedVideoFrame = true
        lastFrameIndex = frameIndex
        return true
    }

    private func fail(_ reason: String) {
        guard failure == nil else {
            return
        }
        failure = reason
        failureHandler(reason)
    }

    private func isCompleteScreenFrame(_ sampleBuffer: CMSampleBuffer) -> Bool {
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(
            sampleBuffer,
            createIfNecessary: false
        ) as? [[SCStreamFrameInfo: Any]],
        let statusRawValue = attachments.first?[.status] as? Int,
        let status = SCFrameStatus(rawValue: statusRawValue)
        else {
            return false
        }
        return status == .complete
    }
}

@available(macOS 12.3, *)
package final class CaptureSession: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    private let configuration: CaptureConfiguration
    private let stopSignal = StopSignal()
    private let sampleQueue = DispatchQueue(
        label: "com.flowtake.macos-capture.samples",
        qos: .userInteractive
    )
    private var writer: CaptureWriter?
    private var frameTimer: DispatchSourceTimer?

    package init(configuration: CaptureConfiguration) {
        self.configuration = configuration
    }

    package func run() async throws {
        if configuration.capturesSystemAudio, #unavailable(macOS 13) {
            throw CaptureRuntimeError.systemAudioRequiresMacOS13
        }

        let shareableContent = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        let (filter, streamConfiguration) = try makeStreamSetup(from: shareableContent)

        if FileManager.default.fileExists(atPath: configuration.outputURL.path) {
            try FileManager.default.removeItem(at: configuration.outputURL)
        }
        try FileManager.default.createDirectory(
            at: configuration.outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        let stopSignal = stopSignal
        let writer = try CaptureWriter(configuration: configuration) { reason in
            stopSignal.signal(.failed(reason))
        }
        self.writer = writer

        let stream = SCStream(filter: filter, configuration: streamConfiguration, delegate: self)
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)
        if configuration.capturesSystemAudio {
            if #available(macOS 13, *) {
                try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: sampleQueue)
            }
        }

        try await stream.startCapture()
        startFrameTimer(writer: writer)
        FileManager.default.createFile(
            atPath: configuration.readyFileURL.path,
            contents: Data("ready\n".utf8)
        )
        installStopReader()

        let stopReason = await stopSignal.wait()
        let stopHostTime = CMClockGetTime(CMClockGetHostTimeClock())
        frameTimer?.cancel()
        frameTimer = nil
        do {
            try await stream.stopCapture()
        } catch {
            if case .requested = stopReason {
                diagnostic("ScreenCaptureKit stop warning: \(error.localizedDescription)")
            }
        }
        // Drain any sample/timer handler already queued before finalizing writer
        // state from this async task.
        sampleQueue.sync {}
        try await writer.finish(atHostTime: stopHostTime)

        if case .failed(let reason) = stopReason {
            throw CaptureRuntimeError.writerFailed(reason)
        }
    }

    package func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        switch outputType {
        case .screen:
            writer?.appendVideo(sampleBuffer)
        case .audio:
            writer?.appendAudio(sampleBuffer)
        case .microphone:
            break
        @unknown default:
            break
        }
    }

    package func stream(_ stream: SCStream, didStopWithError error: any Error) {
        stopSignal.signal(.failed(error.localizedDescription))
    }

    private func makeStreamSetup(
        from content: SCShareableContent
    ) throws -> (SCContentFilter, SCStreamConfiguration) {
        let streamConfiguration = SCStreamConfiguration()
        streamConfiguration.width = configuration.width
        streamConfiguration.height = configuration.height
        streamConfiguration.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        streamConfiguration.minimumFrameInterval = CMTime(
            value: 1,
            timescale: CMTimeScale(configuration.framesPerSecond)
        )
        streamConfiguration.queueDepth = 5
        streamConfiguration.showsCursor = false
        streamConfiguration.scalesToFit = true

        if configuration.capturesSystemAudio {
            if #available(macOS 13, *) {
                streamConfiguration.capturesAudio = true
                streamConfiguration.excludesCurrentProcessAudio = true
                streamConfiguration.sampleRate = 48_000
                streamConfiguration.channelCount = 2
            }
        }

        switch configuration.source {
        case .window:
            guard let windowID = configuration.windowID,
                  let window = content.windows.first(where: { $0.windowID == windowID })
            else {
                throw CaptureRuntimeError.windowNotFound(configuration.windowID ?? 0)
            }
            return (SCContentFilter(desktopIndependentWindow: window), streamConfiguration)

        case .screen, .area:
            guard content.displays.indices.contains(configuration.displayIndex) else {
                throw CaptureRuntimeError.displayNotFound(configuration.displayIndex)
            }
            let display = content.displays[configuration.displayIndex]
            let currentApplication = content.applications.first {
                $0.processID == ProcessInfo.processInfo.processIdentifier
            }
            let filter = SCContentFilter(
                display: display,
                excludingApplications: currentApplication.map { [$0] } ?? [],
                exceptingWindows: []
            )

            if configuration.source == .area {
                let width = Double(display.width)
                let height = Double(display.height)
                let x = width * configuration.areaXPercent / 100
                let y = height * configuration.areaYPercent / 100
                let captureWidth = width * configuration.areaWidthPercent / 100
                let captureHeight = height * configuration.areaHeightPercent / 100
                streamConfiguration.sourceRect = CGRect(
                    x: x,
                    y: y,
                    width: max(1, min(captureWidth, width - x)),
                    height: max(1, min(captureHeight, height - y))
                )
            }
            return (filter, streamConfiguration)
        }
    }

    private func installStopReader() {
        let signal = stopSignal
        DispatchQueue.global(qos: .userInitiated).async {
            _ = readLine()
            signal.signal(.requested)
        }
    }

    private func startFrameTimer(writer: CaptureWriter) {
        let timer = DispatchSource.makeTimerSource(queue: sampleQueue)
        let intervalNanoseconds = max(
            1_000_000_000 / configuration.framesPerSecond,
            1
        )
        timer.schedule(
            deadline: .now(),
            repeating: .nanoseconds(intervalNanoseconds),
            leeway: .milliseconds(2)
        )
        timer.setEventHandler {
            writer.appendVideoFrames(
                through: CMClockGetTime(CMClockGetHostTimeClock())
            )
        }
        frameTimer = timer
        timer.resume()
    }
}

package func diagnostic(_ message: String) {
    guard let data = "[flowtake-macos-capture] \(message)\n".data(using: .utf8) else {
        return
    }
    FileHandle.standardError.write(data)
}
