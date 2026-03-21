import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
    useCallback,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectBackground,
    setBackground
} from "@shared/redux/projectSlice"
import BackgroundPreview from "./BackgroundPreview"
import Fieldset from "./Fieldset"

const Wallpapers = ({ disabled = false }) => {
    const dispatch = useDispatch()
    const background = useSelector(selectBackground)
    const [wallpaperLoading, setWallpaperLoading] = useState(null)

    const { data: wallpapers, isPending: isPendingWallpapers, isError: isErrorWallpapers } = useQuery({
        queryKey: ['wallpapers'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-wallpapers"),
        staleTime: Infinity
    })

    const onClickWallpaper = useCallback(async (path) => {
        if (disabled || wallpaperLoading !== null) return

        setWallpaperLoading(path)
        try {
            await window.electron.ipcRenderer.invoke("update-background", "wallpaper", path)
            dispatch(setBackground({ type: "wallpaper", path }))
        } finally {
            setWallpaperLoading(null)
        }
    }, [disabled, wallpaperLoading, dispatch])

    if (isPendingWallpapers || isErrorWallpapers) {
        return null
    }

    return (
        <Fieldset legend="Wallpaper">
            <div className="grid grid-cols-4 gap-1">
                {wallpapers.map(({ path }, i) => (
                    <BackgroundPreview key={i} isLoading={wallpaperLoading === path}>
                        <img
                            src={`image://wallpaper?path=${path}&thumbnail=true`}
                            onClick={() => onClickWallpaper(path)}
                            className={`aspect-video object-cover object-center rounded-md cursor-pointer border-2 ${background?.path === path ? "border-primary" : "border-transparent"
                                }`}
                            alt="Wallpaper option"
                        />
                    </BackgroundPreview>
                ))}
            </div>
        </Fieldset>
    )
}

Wallpapers.propTypes = {
    disabled: PropTypes.bool
}

export default Wallpapers