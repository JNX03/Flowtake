import { PhotoIcon } from "@heroicons/react/24/outline"
import Card from "./Card"
import Gradients from "./Gradients"
import Wallpapers from "./Wallpapers"
import Photos from "./Photos"
import Colors from "./Colors"

export default function BackgroundSection() {
    return (
        <Card icon={<PhotoIcon className="w-6 h-6" />} title="Background">
            <Gradients />
            <Wallpapers />
            <Photos />
            <Colors />
        </Card>
    )
}