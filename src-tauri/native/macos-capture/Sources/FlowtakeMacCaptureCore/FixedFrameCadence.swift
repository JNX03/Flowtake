import CoreMedia
import Foundation

package struct FixedFrameCadence: Sendable {
    package let framesPerSecond: Int

    package init(framesPerSecond: Int) {
        self.framesPerSecond = max(framesPerSecond, 1)
    }

    package func frameIndex(forElapsedSeconds elapsedSeconds: Double) -> Int64 {
        let boundedSeconds = max(elapsedSeconds, 0)
        return Int64(floor(boundedSeconds * Double(framesPerSecond) + 0.001))
    }

    package func presentationTime(
        forFrameIndex frameIndex: Int64,
        startingAt startTime: CMTime
    ) -> CMTime {
        CMTimeAdd(
            startTime,
            CMTime(value: max(frameIndex, 0), timescale: CMTimeScale(framesPerSecond))
        )
    }
}
