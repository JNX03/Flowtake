import {
    useEffect,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { ActionCreators } from "redux-undo"
import TitleBar from "../../../components/TitleBar"
import {
    selectHasProject,
    setLoaderMessage
} from "../../../src/redux/appSlice"
import { selectIsInitialized } from "../../../src/redux/editorSlice"
import {
    selectName
} from "../../../src/redux/projectSlice"
import AssetPanel from "./assets/AssetPanel"
import ExportButton from "./ExportButton"
import PresetsDropdown from "./presets/PresetsDropdown"
import Preview from "./Preview"
import Properties from "./properties/Properties"
import Timeline from "./timeline/Timeline"
import ActivateButton from "./titleBar/ActivateButton"
import CloseButton from "./titleBar/CloseButton"
import RedoButton from "./titleBar/RedoButton"
import RenameButton from "./titleBar/RenameButton"
import RequestFeatureButton from "./titleBar/RequestFeatureButton"
import SaveIndicator from "./titleBar/SaveIndicator"
import SettingsButton from "./titleBar/SettingsButton"
import UndoButton from "./titleBar/UndoButton"
import UpgradeButton from "./titleBar/UpgradeButton"

export default function Editor() {

    const dispatch = useDispatch()
    const hasProject = useSelector(selectHasProject)
    const isInitialized = useSelector(selectIsInitialized)
    const name = useSelector(selectName)
    const [isAssetPanelOpen, setIsAssetPanelOpen] = useState(true)

    useEffect(() => {
        if (hasProject) dispatch(ActionCreators.clearHistory())
    }, [hasProject, dispatch])

    useEffect(() => {
        dispatch(setLoaderMessage(isInitialized ? null : "Opening editor..."))
    }, [isInitialized, dispatch])

    return (<>
        <TitleBar overlayButtons={3} subtitle={name} >
            <SaveIndicator />
            <UndoButton />
            <RedoButton />
            <RenameButton />
            <CloseButton />
            <ActivateButton />
            <ExportButton />
            <PresetsDropdown />
            <RequestFeatureButton />
            <SettingsButton />
            <UpgradeButton />
        </TitleBar>
        <div className="bg-base-300 flex flex-col h-full relative">
            {/* Top section: Assets | Preview | Properties */}
            <div className="pt-1 pl-2 pr-2 flex gap-2 flex-1 overflow-auto min-h-0">
                <AssetPanel
                    isOpen={isAssetPanelOpen}
                    onToggle={() => setIsAssetPanelOpen(!isAssetPanelOpen)}
                />
                <Preview />
                <Properties />
            </div>
            {/* Bottom section: Timeline */}
            <Timeline />
        </div>
    </>)
}
