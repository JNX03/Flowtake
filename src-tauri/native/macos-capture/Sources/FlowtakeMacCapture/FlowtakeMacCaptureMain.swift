import Foundation
import FlowtakeMacCaptureCore

struct Capabilities: Encodable {
    let available: Bool
    let supportsSystemAudio: Bool
    let captureEngine: String
    let minimumSystemVersion: String
}

@main
enum FlowtakeMacCaptureMain {
    static func main() async {
        do {
            let arguments = Array(CommandLine.arguments.dropFirst())
            guard let command = arguments.first else {
                throw ConfigurationError.missingCommand
            }

            switch command {
            case "capabilities":
                try printCapabilities()
            case "record":
                guard #available(macOS 12.3, *) else {
                    throw CaptureRuntimeError.unsupportedSystem
                }
                let configuration = try CaptureConfiguration.parse(arguments: arguments)
                try await CaptureSession(configuration: configuration).run()
            default:
                throw ConfigurationError.unsupportedCommand(command)
            }
        } catch {
            diagnostic(error.localizedDescription)
            exit(EXIT_FAILURE)
        }
    }

    private static func printCapabilities() throws {
        let available: Bool
        if #available(macOS 12.3, *) {
            available = true
        } else {
            available = false
        }

        let supportsSystemAudio: Bool
        if #available(macOS 13, *) {
            supportsSystemAudio = true
        } else {
            supportsSystemAudio = false
        }

        let payload = Capabilities(
            available: available,
            supportsSystemAudio: supportsSystemAudio,
            captureEngine: "ScreenCaptureKit",
            minimumSystemVersion: "12.3"
        )
        let data = try JSONEncoder().encode(payload)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data("\n".utf8))
    }
}
