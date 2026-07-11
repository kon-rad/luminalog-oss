import Foundation

/// Projects a 512-d day centroid onto the three pinned bipolar anchor axes
/// (valence, inward, arousal) via a fixed `tanh` transform. A star's position
/// depends ONLY on its own centroid — never on other days — so stars never move.
enum AnchoredProjection {
    static func project(_ centroid: [Float]) -> (x: Double, y: Double, z: Double) {
        guard centroid.count == EmbeddingVector.dimension else { return (0, 0, 0) }
        var coords = [0.0, 0.0, 0.0]
        for k in 0..<3 {
            let axis = AnchorConstants.axes[k]
            var dot = 0.0
            for i in 0..<axis.count { dot += axis[i] * Double(centroid[i]) }
            coords[k] = tanh(AnchorConstants.gains[k] * dot)
        }
        return (coords[0], coords[1], coords[2])
    }

    static func project(_ v: EmbeddingVector) -> (x: Double, y: Double, z: Double) {
        project(v.values)
    }
}
