// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "FlowtakeMacCapture",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .executable(
            name: "flowtake-macos-capture",
            targets: ["FlowtakeMacCapture"]
        ),
        .executable(
            name: "flowtake-macos-capture-tests",
            targets: ["FlowtakeMacCaptureTests"]
        )
    ],
    targets: [
        .target(
            name: "FlowtakeMacCaptureCore"
        ),
        .executableTarget(
            name: "FlowtakeMacCapture",
            dependencies: ["FlowtakeMacCaptureCore"]
        ),
        .executableTarget(
            name: "FlowtakeMacCaptureTests",
            dependencies: ["FlowtakeMacCaptureCore"],
            path: "Tests/FlowtakeMacCaptureTests"
        )
    ]
)
