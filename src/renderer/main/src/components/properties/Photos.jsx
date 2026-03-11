import { PhotoIcon } from "@heroicons/react/24/outline"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import {
    useCallback,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import {
    selectBackground,
    setBackground
} from "../../../../src/redux/projectSlice"
import BackgroundPreview from "./BackgroundPreview"
import Fieldset from "./Fieldset"

const Photos = () => {
    const dispatch = useDispatch()
    const queryClient = useQueryClient()

    const background = useSelector(selectBackground)
    const [imageLoading, setImageLoading] = useState(null)

    const { data: images, isPending: isPendingImages, isError: isErrorImages } = useQuery({
        queryKey: ['backgroundImages'],
        queryFn: async () => {
            const rawImages = await window.electron.ipcRenderer.invoke("get-background-images")
            return rawImages.map(({ path, thumbnailBuffer, type }) => (
                { path, thumbnailUrl: URL.createObjectURL(new Blob([thumbnailBuffer], { type })) }
            ))
        },
        staleTime: Infinity
    })

    const { mutate: onOpenPhoto, isPending: isOpenPhotoPending } = useMutation({
        mutationFn: async () => {
            const path = await window.electron.ipcRenderer.invoke("choose-background-image")
            if (path) {
                await window.electron.ipcRenderer.invoke("update-background", "image", path)
                return { isDirty: true, path }
            }
            return { isDirty: false }
        },
        onSuccess: (result) => {
            if (result.isDirty) {
                queryClient.invalidateQueries({ queryKey: ['backgroundImages'] })
                dispatch(setBackground({ type: "image", path: result.path }))
            }
        },
    })

    const onClickImage = useCallback(async (path) => {
        if (imageLoading !== null) return

        setImageLoading(path)
        try {
            await window.electron.ipcRenderer.invoke("update-background", "image", path)
            dispatch(setBackground({ type: "image", path }))
        } finally {
            setImageLoading(null)
        }
    }, [imageLoading, dispatch])

    const hasImages = !isPendingImages && !isErrorImages && images && images.length > 0

    return (
        <Fieldset legend="Photo">
            {(hasImages || isOpenPhotoPending) && (
                <div className="grid grid-cols-4 gap-1">
                    {hasImages && images.map(({ path, thumbnailUrl }, i) => (
                        <BackgroundPreview key={i} isLoading={imageLoading === path}>
                            <img
                                src={thumbnailUrl}
                                onClick={() => onClickImage(path)}
                                className={`aspect-video object-cover object-center rounded-md cursor-pointer border-2 ${background?.path === path ? "border-primary" : "border-transparent"
                                    }`}
                                alt="Photo option"
                            />
                        </BackgroundPreview>
                    ))}
                    {isOpenPhotoPending && (
                        <div className="aspect-video rounded-md border-2 border-transparent bg-base-300 flex items-center justify-center">
                            <span className="loading loading-spinner loading-xs text-primary"></span>
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-center justify-center mt-2">
                <Button
                    onClick={onOpenPhoto}
                    icon={PhotoIcon}
                    isLoading={isOpenPhotoPending}
                    disabled={isOpenPhotoPending}
                >
                    Open photo
                </Button>
            </div>
        </Fieldset>
    )
}

export default Photos