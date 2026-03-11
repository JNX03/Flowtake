import {
    ChevronLeftIcon,
    ChevronRightIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
    useState
} from "react"
import Modal from "../Modal"
import Preset from "./Preset"

export default function PresetsModal({ isOpen, close, onRename, onDirty }) {

    const [page, setPage] = useState(0)

    const { data: presets, isPending, isError, refetch } = useQuery({
        queryKey: ['presets', page],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get-paginated", "presets", page, 10),
        enabled: isOpen,
        staleTime: Infinity
    })

    const onPresetsDirty = () => {
        refetch()
        onDirty()
    }

    return (<Modal isOpen={isOpen} title={"All presets"} close={close}>
        <ul className="dropdown-content menu menu-sm border-base-300/10 border-2 bg-base-300/70 backdrop-blur-md rounded-lg shadow-lg w-full">
            {!isPending && !isError && presets.items.map((preset, i) =>
                <Preset key={i} presetDescriptor={preset} onRename={onRename} onDirty={onPresetsDirty} />)}
        </ul>
        <div className="flex justify-center mt-5">
            <div className="join">
                <button className="join-item btn" onClick={() => setPage(page - 1)}
                    disabled={isPending || isError || page === 0}>
                    <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button className="join-item btn" onClick={() => setPage(page + 1)}
                    disabled={isPending || isError || page === presets.totalPages - 1}>
                    <ChevronRightIcon className="h-6 w-6" />
                </button>
            </div>
        </div>
    </Modal>)
}

PresetsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    close: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired,
    onDirty: PropTypes.func.isRequired
}