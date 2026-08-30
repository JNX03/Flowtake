// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "FlowtakeMacCapture",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .executable(
            name: "flowtake-macos-capture",
            targets: ["FlowtakeMacCapture"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "FlowtakeMacCapture",
            path: "Sources"
        ),
    ]
)
