import Foundation
import FlowtakeMacCaptureCore

enum TestFailure: Error {
    case failed(String)
}

@main
enum CaptureConfigurationTests {
    static func main() throws {
        try testParsesScreenRecordingAndNormalizesEvenDimensions()
        try testRequiresStableWindowIdentifier()
        try testClampsAreaPercentagesToSelectedDisplay()
        try testRejectsFrameRatesThatAppDoesNotExpose()
        try testRejectsInvalidExcludedProcess()
        try testFixedFrameCadenceFillsIrregularCaptureGaps()
        try testParsesPreviewProxyConfiguration()
        try testPreviewBoundsHandleLandscapeAndPortraitVideos()
        try testRejectsInvalidPreviewBounds()
        print("Flowtake macOS capture tests passed (9 tests)")
    }

    static func expect(
        _ condition: @autoclosure () -> Bool,
        _ message: String
    ) throws {
        if !condition() {
            throw TestFailure.failed(message)
        }
    }

    static func expectError(
        _ expected: ConfigurationError,
        operation: () throws -> Void
    ) throws {
        do {
            try operation()
            throw TestFailure.failed("Expected \(expected), but the operation succeeded")
        } catch let error as ConfigurationError {
            try expect(error == expected, "Expected \(expected), got \(error)")
        }
    }

    static func testParsesScreenRecordingAndNormalizesEvenDimensions() throws {
        let configuration = try CaptureConfiguration.parse(arguments: [
            "record",
            "--output", "/tmp/flowtake/screen.mp4",
            "--ready-file", "/tmp/flowtake/ready",
            "--source-type", "screen",
            "--display-index", "1",
            "--width", "1921",
            "--height", "1081",
            "--fps", "60",
            "--bitrate", "12000000",
            "--exclude-process-id", "4321",
            "--audio"
        ])

        try expect(configuration.source == .screen, "Screen source was not parsed")
        try expect(configuration.displayIndex == 1, "Display index was not parsed")
        try expect(configuration.width == 1920, "Width was not normalized")
        try expect(configuration.height == 1080, "Height was not normalized")
        try expect(configuration.framesPerSecond == 60, "Frame rate was not parsed")
        try expect(configuration.capturesSystemAudio, "Audio flag was not parsed")
        try expect(configuration.excludedProcessID == 4321, "Excluded app process was not parsed")
    }

    static func testRequiresStableWindowIdentifier() throws {
        try expectError(.missingRequiredOption("--window-id")) {
            _ = try CaptureConfiguration.parse(arguments: [
                "record",
                "--output", "/tmp/screen.mp4",
                "--ready-file", "/tmp/ready",
                "--source-type", "window",
                "--width", "1280",
                "--height", "720",
                "--bitrate", "9000000"
            ])
        }
    }

    static func testClampsAreaPercentagesToSelectedDisplay() throws {
        let configuration = try CaptureConfiguration.parse(arguments: [
            "record",
            "--output", "/tmp/screen.mp4",
            "--ready-file", "/tmp/ready",
            "--source-type", "area",
            "--width", "800",
            "--height", "600",
            "--bitrate", "4000000",
            "--x-percent", "-10",
            "--y-percent", "20",
            "--width-percent", "110",
            "--height-percent", "75"
        ])

        try expect(configuration.areaXPercent == 0, "Area x was not clamped")
        try expect(configuration.areaYPercent == 20, "Area y changed unexpectedly")
        try expect(configuration.areaWidthPercent == 100, "Area width was not clamped")
        try expect(configuration.areaHeightPercent == 75, "Area height changed unexpectedly")
        try expect(configuration.excludedProcessID == nil, "Unexpected app exclusion was enabled")
    }

    static func testRejectsFrameRatesThatAppDoesNotExpose() throws {
        try expectError(.invalidValue("--fps", "24")) {
            _ = try CaptureConfiguration.parse(arguments: [
                "record",
                "--output", "/tmp/screen.mp4",
                "--ready-file", "/tmp/ready",
                "--source-type", "screen",
                "--width", "1920",
                "--height", "1080",
                "--fps", "24",
                "--bitrate", "9000000"
            ])
        }
    }

    static func testRejectsInvalidExcludedProcess() throws {
        try expectError(.invalidValue("--exclude-process-id", "0")) {
            _ = try CaptureConfiguration.parse(arguments: [
                "record",
                "--output", "/tmp/screen.mp4",
                "--ready-file", "/tmp/ready",
                "--source-type", "screen",
                "--width", "1920",
                "--height", "1080",
                "--bitrate", "9000000",
                "--exclude-process-id", "0"
            ])
        }
    }

    static func testFixedFrameCadenceFillsIrregularCaptureGaps() throws {
        let cadence = FixedFrameCadence(framesPerSecond: 30)

        try expect(cadence.frameIndex(forElapsedSeconds: 0) == 0, "Cadence must start at frame zero")
        try expect(
            cadence.frameIndex(forElapsedSeconds: 0.016) == 0,
            "A 60 fps source sample must not advance a 30 fps output early"
        )
        try expect(
            cadence.frameIndex(forElapsedSeconds: 0.034) == 1,
            "The next 30 fps output frame must land near 33 ms"
        )
        try expect(
            cadence.frameIndex(forElapsedSeconds: 0.101) == 3,
            "Irregular source gaps must map to every missing fixed-cadence frame"
        )
    }

    static func testParsesPreviewProxyConfiguration() throws {
        let configuration = try PreviewProxyConfiguration.parse(arguments: [
            "make-preview-proxy",
            "--input", "/tmp/source.mp4",
            "--output", "/tmp/preview.mp4",
            "--max-width", "1280",
            "--max-height", "720"
        ])

        try expect(configuration.inputURL.path == "/tmp/source.mp4", "Proxy input was not parsed")
        try expect(configuration.outputURL.path == "/tmp/preview.mp4", "Proxy output was not parsed")
        try expect(configuration.maximumWidth == 1280, "Proxy width was not parsed")
        try expect(configuration.maximumHeight == 720, "Proxy height was not parsed")
    }

    static func testPreviewBoundsHandleLandscapeAndPortraitVideos() throws {
        let landscape = PreviewDimensions(width: 1280, height: 720)
        let portrait = PreviewDimensions(width: 720, height: 1280)
        let oversizedLandscape = PreviewDimensions(width: 2560, height: 1440)
        let oversizedPortrait = PreviewDimensions(width: 1440, height: 2560)

        try expect(
            landscape.fits(maximumWidth: 1280, maximumHeight: 720),
            "A 720p landscape preview must fit"
        )
        try expect(
            portrait.fits(maximumWidth: 1280, maximumHeight: 720),
            "A 720p portrait preview must fit with rotated limits"
        )
        try expect(
            !oversizedLandscape.fits(maximumWidth: 1280, maximumHeight: 720),
            "An oversized landscape recording must be transcoded"
        )
        try expect(
            !oversizedPortrait.fits(maximumWidth: 1280, maximumHeight: 720),
            "An oversized portrait recording must be transcoded"
        )
        try expect(
            PreviewDimensions(width: 2940, height: 1912)
                .scaledToFit(maximumWidth: 1280, maximumHeight: 720)
                == PreviewDimensions(width: 1106, height: 720),
            "A tall Mac display must fit within the complete 720p editor budget"
        )
        try expect(
            oversizedPortrait.scaledToFit(maximumWidth: 1280, maximumHeight: 720)
                == PreviewDimensions(width: 720, height: 1280),
            "Portrait previews must rotate the editor bounds"
        )
    }

    static func testRejectsInvalidPreviewBounds() throws {
        try expectError(.invalidValue("--max-width", "0")) {
            _ = try PreviewProxyConfiguration.parse(arguments: [
                "make-preview-proxy",
                "--input", "/tmp/source.mp4",
                "--output", "/tmp/preview.mp4",
                "--max-width", "0"
            ])
        }
    }
}
