@preconcurrency import AVFoundation
import CoreGraphics
import Foundation

package struct PreviewProxyConfiguration: Equatable, Sendable {
    package let inputURL: URL
    package let outputURL: URL
    package let maximumWidth: Int
    package let maximumHeight: Int

    package static func parse(arguments: [String]) throws -> PreviewProxyConfiguration {
        guard let command = arguments.first else {
            throw ConfigurationError.missingCommand
        }
        guard command == "make-preview-proxy" else {
            throw ConfigurationError.unsupportedCommand(command)
        }

        var values: [String: String] = [:]
        var index = 1
        while index < arguments.count {
            let option = arguments[index]
            guard option.hasPrefix("--") else {
                throw ConfigurationError.invalidValue("argument", option)
            }
            guard index + 1 < arguments.count else {
                throw ConfigurationError.missingValue(option)
            }
            values[option] = arguments[index + 1]
            index += 2
        }

        func required(_ option: String) throws -> String {
            guard let value = values[option], !value.isEmpty else {
                throw ConfigurationError.missingRequiredOption(option)
            }
            return value
        }

        func positiveInteger(_ option: String, default defaultValue: Int) throws -> Int {
            guard let value = values[option] else {
                return defaultValue
            }
            guard let parsed = Int(value), parsed > 0 else {
                throw ConfigurationError.invalidValue(option, value)
            }
            return parsed
        }

        return PreviewProxyConfiguration(
            inputURL: URL(fileURLWithPath: try required("--input")),
            outputURL: URL(fileURLWithPath: try required("--output")),
            maximumWidth: try positiveInteger("--max-width", default: 1280),
            maximumHeight: try positiveInteger("--max-height", default: 720)
        )
    }
}

package struct PreviewDimensions: Equatable, Sendable {
    package let width: Int
    package let height: Int

    package init(width: Int, height: Int) {
        self.width = width
        self.height = height
    }

    package func fits(maximumWidth: Int, maximumHeight: Int) -> Bool {
        let landscape = width >= height
        let widthLimit = landscape ? maximumWidth : maximumHeight
        let heightLimit = landscape ? maximumHeight : maximumWidth
        return width <= widthLimit && height <= heightLimit
    }

    package func scaledToFit(maximumWidth: Int, maximumHeight: Int) -> Self {
        let landscape = width >= height
        let widthLimit = landscape ? maximumWidth : maximumHeight
        let heightLimit = landscape ? maximumHeight : maximumWidth
        let scale = min(
            min(Double(widthLimit) / Double(width), Double(heightLimit) / Double(height)),
            1
        )
        let scaledWidth = max(Int((Double(width) * scale).rounded(.down)), 2)
        let scaledHeight = max(Int((Double(height) * scale).rounded(.down)), 2)
        return Self(
            width: scaledWidth - (scaledWidth % 2),
            height: scaledHeight - (scaledHeight % 2)
        )
    }

    static func displayed(naturalSize: CGSize, preferredTransform: CGAffineTransform) -> Self {
        let transformed = naturalSize.applying(preferredTransform)
        return Self(
            width: max(Int(abs(transformed.width).rounded()), 1),
            height: max(Int(abs(transformed.height).rounded()), 1)
        )
    }
}

package struct PreviewProxyResult: Encodable, Sendable {
    package let created: Bool
    package let inputWidth: Int
    package let inputHeight: Int
    package let outputWidth: Int
    package let outputHeight: Int
    package let preservesAudio: Bool
    package let elapsedMilliseconds: Int
}

package enum PreviewProxyError: LocalizedError {
    case inputNotFound
    case missingVideoTrack
    case unsupportedMP4Export
    case exportFailed(String)
    case invalidOutput(String)

    package var errorDescription: String? {
        switch self {
        case .inputNotFound:
            return "The preview source recording does not exist."
        case .missingVideoTrack:
            return "The preview source does not contain a video track."
        case .unsupportedMP4Export:
            return "AVFoundation cannot export this recording as an MP4 preview."
        case .exportFailed(let reason):
            return "AVFoundation preview export failed: \(reason)"
        case .invalidOutput(let reason):
            return "AVFoundation created an invalid preview: \(reason)"
        }
    }
}

package enum PreviewProxyTranscoder {
    package static func transcode(
        configuration: PreviewProxyConfiguration
    ) async throws -> PreviewProxyResult {
        let start = Date()
        let activity = ProcessInfo.processInfo.beginActivity(
            options: [.userInitiated, .latencyCritical],
            reason: "Preparing a responsive Flowtake editor preview"
        )
        defer {
            ProcessInfo.processInfo.endActivity(activity)
        }
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: configuration.inputURL.path) else {
            throw PreviewProxyError.inputNotFound
        }

        let asset = AVURLAsset(
            url: configuration.inputURL,
            options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]
        )
        guard let inputVideoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            throw PreviewProxyError.missingVideoTrack
        }
        let inputDimensions = try await dimensions(of: inputVideoTrack)
        let inputHasAudio = try await !asset.loadTracks(withMediaType: .audio).isEmpty
        if inputDimensions.fits(
            maximumWidth: configuration.maximumWidth,
            maximumHeight: configuration.maximumHeight
        ) {
            return PreviewProxyResult(
                created: false,
                inputWidth: inputDimensions.width,
                inputHeight: inputDimensions.height,
                outputWidth: inputDimensions.width,
                outputHeight: inputDimensions.height,
                preservesAudio: true,
                elapsedMilliseconds: elapsedMilliseconds(since: start)
            )
        }

        let outputDirectory = configuration.outputURL.deletingLastPathComponent()
        try fileManager.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true
        )
        let partialURL = outputDirectory.appendingPathComponent(
            ".\(configuration.outputURL.deletingPathExtension().lastPathComponent)-\(UUID().uuidString).partial.mp4"
        )
        defer {
            try? fileManager.removeItem(at: partialURL)
        }

        guard let exporter = AVAssetExportSession(
            asset: asset,
            presetName: AVAssetExportPreset1280x720
        ) else {
            throw PreviewProxyError.unsupportedMP4Export
        }
        guard exporter.supportedFileTypes.contains(.mp4) else {
            throw PreviewProxyError.unsupportedMP4Export
        }

        exporter.outputURL = partialURL
        exporter.outputFileType = .mp4
        exporter.shouldOptimizeForNetworkUse = true
        exporter.videoComposition = try await videoComposition(
            asset: asset,
            videoTrack: inputVideoTrack,
            inputDimensions: inputDimensions,
            outputDimensions: inputDimensions.scaledToFit(
                maximumWidth: configuration.maximumWidth,
                maximumHeight: configuration.maximumHeight
            )
        )
        await withCheckedContinuation { continuation in
            exporter.exportAsynchronously {
                continuation.resume()
            }
        }

        guard exporter.status == .completed else {
            throw PreviewProxyError.exportFailed(
                exporter.error?.localizedDescription ?? "export status \(exporter.status.rawValue)"
            )
        }
        guard let outputSize = try? partialURL.resourceValues(
            forKeys: [.fileSizeKey, .isRegularFileKey]
        ), outputSize.isRegularFile == true, (outputSize.fileSize ?? 0) > 0 else {
            throw PreviewProxyError.invalidOutput("the exported file is empty")
        }

        let outputAsset = AVURLAsset(
            url: partialURL,
            options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]
        )
        let outputDimensions = try await dimensions(of: outputAsset)
        guard outputDimensions.fits(
            maximumWidth: configuration.maximumWidth,
            maximumHeight: configuration.maximumHeight
        ) else {
            throw PreviewProxyError.invalidOutput(
                "\(outputDimensions.width)x\(outputDimensions.height) exceeds the configured bounds"
            )
        }
        let outputHasAudio = try await !outputAsset.loadTracks(withMediaType: .audio).isEmpty
        guard !inputHasAudio || outputHasAudio else {
            throw PreviewProxyError.invalidOutput("the source audio track was not preserved")
        }

        if fileManager.fileExists(atPath: configuration.outputURL.path) {
            try fileManager.removeItem(at: configuration.outputURL)
        }
        try fileManager.moveItem(at: partialURL, to: configuration.outputURL)

        return PreviewProxyResult(
            created: true,
            inputWidth: inputDimensions.width,
            inputHeight: inputDimensions.height,
            outputWidth: outputDimensions.width,
            outputHeight: outputDimensions.height,
            preservesAudio: !inputHasAudio || outputHasAudio,
            elapsedMilliseconds: elapsedMilliseconds(since: start)
        )
    }

    private static func dimensions(of asset: AVAsset) async throws -> PreviewDimensions {
        guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            throw PreviewProxyError.missingVideoTrack
        }
        return try await dimensions(of: videoTrack)
    }

    private static func dimensions(
        of videoTrack: AVAssetTrack
    ) async throws -> PreviewDimensions {
        let naturalSize = try await videoTrack.load(.naturalSize)
        let preferredTransform = try await videoTrack.load(.preferredTransform)
        return PreviewDimensions.displayed(
            naturalSize: naturalSize,
            preferredTransform: preferredTransform
        )
    }

    private static func videoComposition(
        asset: AVAsset,
        videoTrack: AVAssetTrack,
        inputDimensions: PreviewDimensions,
        outputDimensions: PreviewDimensions
    ) async throws -> AVMutableVideoComposition {
        let naturalSize = try await videoTrack.load(.naturalSize)
        let preferredTransform = try await videoTrack.load(.preferredTransform)
        let orientedRect = CGRect(origin: .zero, size: naturalSize).applying(preferredTransform)
        let normalize = CGAffineTransform(
            translationX: -orientedRect.minX,
            y: -orientedRect.minY
        )
        let scale = CGAffineTransform(
            scaleX: Double(outputDimensions.width) / Double(inputDimensions.width),
            y: Double(outputDimensions.height) / Double(inputDimensions.height)
        )

        let layerInstruction = AVMutableVideoCompositionLayerInstruction(
            assetTrack: videoTrack
        )
        layerInstruction.setTransform(
            preferredTransform.concatenating(normalize).concatenating(scale),
            at: .zero
        )

        let duration = try await asset.load(.duration)
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
        instruction.layerInstructions = [layerInstruction]

        let nominalFrameRate = try await videoTrack.load(.nominalFrameRate)
        let frameRate = max(min(Int32(nominalFrameRate.rounded()), 60), 1)
        let composition = AVMutableVideoComposition()
        composition.renderSize = CGSize(
            width: outputDimensions.width,
            height: outputDimensions.height
        )
        composition.frameDuration = CMTime(value: 1, timescale: frameRate)
        composition.instructions = [instruction]
        return composition
    }

    private static func elapsedMilliseconds(
        since start: Date
    ) -> Int {
        max(Int(Date().timeIntervalSince(start) * 1_000), 0)
    }
}
