import Foundation

package enum CaptureSource: String, Equatable, Sendable {
    case screen
    case window
    case area
}

package enum ConfigurationError: LocalizedError, Equatable {
    case missingCommand
    case unsupportedCommand(String)
    case missingValue(String)
    case invalidValue(String, String)
    case missingRequiredOption(String)

    package var errorDescription: String? {
        switch self {
        case .missingCommand:
            return "Missing command. Use capabilities or record."
        case .unsupportedCommand(let command):
            return "Unsupported command: \(command)"
        case .missingValue(let option):
            return "Missing value for \(option)"
        case .invalidValue(let option, let value):
            return "Invalid value for \(option): \(value)"
        case .missingRequiredOption(let option):
            return "Missing required option: \(option)"
        }
    }
}

package struct CaptureConfiguration: Equatable, Sendable {
    package let outputURL: URL
    package let readyFileURL: URL
    package let source: CaptureSource
    package let displayIndex: Int
    package let windowID: UInt32?
    package let width: Int
    package let height: Int
    package let framesPerSecond: Int
    package let bitrate: Int
    package let capturesSystemAudio: Bool
    package let areaXPercent: Double
    package let areaYPercent: Double
    package let areaWidthPercent: Double
    package let areaHeightPercent: Double

    package static func parse(arguments: [String]) throws -> CaptureConfiguration {
        guard let command = arguments.first else {
            throw ConfigurationError.missingCommand
        }
        guard command == "record" else {
            throw ConfigurationError.unsupportedCommand(command)
        }

        var values: [String: String] = [:]
        var flags = Set<String>()
        var index = 1
        while index < arguments.count {
            let option = arguments[index]
            guard option.hasPrefix("--") else {
                throw ConfigurationError.invalidValue("argument", option)
            }
            if option == "--audio" {
                flags.insert(option)
                index += 1
                continue
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

        func integer(_ option: String, default defaultValue: Int? = nil) throws -> Int {
            guard let value = values[option] else {
                if let defaultValue {
                    return defaultValue
                }
                throw ConfigurationError.missingRequiredOption(option)
            }
            guard let parsed = Int(value) else {
                throw ConfigurationError.invalidValue(option, value)
            }
            return parsed
        }

        func percentage(_ option: String, default defaultValue: Double) throws -> Double {
            guard let value = values[option] else {
                return defaultValue
            }
            guard let parsed = Double(value), parsed.isFinite else {
                throw ConfigurationError.invalidValue(option, value)
            }
            return parsed.clamped(to: 0 ... 100)
        }

        let sourceValue = try required("--source-type")
        guard let source = CaptureSource(rawValue: sourceValue) else {
            throw ConfigurationError.invalidValue("--source-type", sourceValue)
        }

        let windowID: UInt32?
        if source == .window {
            let value = try required("--window-id")
            guard let parsed = UInt32(value), parsed > 0 else {
                throw ConfigurationError.invalidValue("--window-id", value)
            }
            windowID = parsed
        } else {
            windowID = nil
        }

        let width = try integer("--width")
        let height = try integer("--height")
        guard width > 0 else {
            throw ConfigurationError.invalidValue("--width", String(width))
        }
        guard height > 0 else {
            throw ConfigurationError.invalidValue("--height", String(height))
        }

        let fps = try integer("--fps", default: 30)
        guard fps == 30 || fps == 60 else {
            throw ConfigurationError.invalidValue("--fps", String(fps))
        }

        let bitrate = try integer("--bitrate")
        guard bitrate >= 1_000_000 else {
            throw ConfigurationError.invalidValue("--bitrate", String(bitrate))
        }

        let displayIndex = try integer("--display-index", default: 0)
        guard displayIndex >= 0 else {
            throw ConfigurationError.invalidValue("--display-index", String(displayIndex))
        }

        return CaptureConfiguration(
            outputURL: URL(fileURLWithPath: try required("--output")),
            readyFileURL: URL(fileURLWithPath: try required("--ready-file")),
            source: source,
            displayIndex: displayIndex,
            windowID: windowID,
            width: width.roundedDownToEven(minimum: 16),
            height: height.roundedDownToEven(minimum: 16),
            framesPerSecond: fps,
            bitrate: bitrate,
            capturesSystemAudio: flags.contains("--audio"),
            areaXPercent: try percentage("--x-percent", default: 0),
            areaYPercent: try percentage("--y-percent", default: 0),
            areaWidthPercent: try percentage("--width-percent", default: 100),
            areaHeightPercent: try percentage("--height-percent", default: 100)
        )
    }
}

extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

extension Int {
    func roundedDownToEven(minimum: Int) -> Int {
        let bounded = Swift.max(self, minimum)
        return bounded - (bounded % 2)
    }
}
