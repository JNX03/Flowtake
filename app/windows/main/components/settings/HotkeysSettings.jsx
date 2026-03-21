import { ArrowLongLeftIcon, ArrowLongRightIcon } from "@heroicons/react/20/solid"
import { useHotkeys } from "react-hotkeys-hook"
import { setOpenSettings } from "@shared/redux/appSlice"
import { useDispatch } from "react-redux"

export default function HotkeysSettings() {

    const dispatch = useDispatch()

    useHotkeys("ctrl+slash", () => { dispatch(setOpenSettings(null)) })

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">Hotkeys</h4>
        <table className="table table-sm table-zebra w-full rounded-box overflow-hidden">
            <thead><tr><th>General</th><th></th></tr></thead>
            <tbody>
                <tr>
                    <th>Play / pause</th>
                    <td className="text-right"><kbd className="kbd kbd-sm">space</kbd></td>
                </tr>
                <tr>
                    <th>Rename project</th>
                    <td className="text-right"><kbd className="kbd kbd-sm">F2</kbd></td>
                </tr>
                <tr>
                    <th>Close project</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">w</kbd></td>
                </tr>
                <tr>
                    <th>Open settings</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">,</kbd></td>
                </tr>
                <tr>
                    <th>Open exporter</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">e</kbd></td>
                </tr>
                <tr>
                    <th>Open hotkeys</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">/</kbd></td>
                </tr>
                <tr>
                    <th>Close modal</th>
                    <td className="text-right"><kbd className="kbd kbd-sm">esc</kbd></td>
                </tr>
                <tr>
                    <th>Undo</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">z</kbd></td>
                </tr>
                <tr>
                    <th>Redo</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">y</kbd></td>
                </tr>
            </tbody>
            <thead className="pt-6"><tr><th>Timeline</th><th></th></tr></thead>
            <tbody>
                <tr>
                    <th>Zoom in timeline</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">+</kbd></td>
                </tr>
                <tr>
                    <th>Zoom out timeline</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">-</kbd></td>
                </tr>
                <tr>
                    <th>Scroll timeline</th>
                    <td className="text-right">
                        <kbd className="kbd kbd-sm align-bottom inline-flex items-center mr-2">
                            <ArrowLongLeftIcon className="size-4" />
                        </kbd>
                        <kbd className="kbd kbd-sm align-bottom inline-flex items-center mr-2">
                            <ArrowLongRightIcon className="size-4" />
                        </kbd>
                        or hold
                        <kbd className="kbd kbd-sm mx-2">shift</kbd>
                        and scroll
                    </td>
                </tr>
                <tr>
                    <th>Select all elements in a row</th>
                    <td className="text-right"><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">a</kbd></td>
                </tr>
                <tr>
                    <th>Select multiple elements in a row</th>
                    <td className="text-right">Hold<kbd className="kbd kbd-sm ml-2">ctrl</kbd></td>
                </tr>
                <tr>
                    <th>Select adjacent elements in a row</th>
                    <td className="text-right">Hold<kbd className="kbd kbd-sm ml-2">shift</kbd></td>
                </tr>
                <tr>
                    <th>Clear selection</th>
                    <td className="text-right"><kbd className="kbd kbd-sm">esc</kbd></td>
                </tr>
                <tr>
                    <th>Split selected element</th>
                    <td className="text-right"><kbd className="kbd kbd-sm">s</kbd></td>
                </tr>
                <tr>
                    <th>Merge selected element left</th>
                    <td className="text-right">
                        <kbd className="kbd kbd-sm mr-2">ctrl</kbd>
                        <kbd className="kbd kbd-sm align-bottom inline-flex items-center">
                            <ArrowLongLeftIcon className="size-4" />
                        </kbd>
                    </td>
                </tr>
                <tr>
                    <th>Merge selected element right</th>
                    <td className="text-right">
                        <kbd className="kbd kbd-sm mr-2">m</kbd>
                        <kbd className="kbd kbd-sm align-bottom inline-flex items-center">
                            <ArrowLongRightIcon className="size-4" />
                        </kbd>
                    </td>
                </tr>
                <tr>
                    <th>Maximize selected element</th>
                    <td className="text-right">
                        <kbd className="kbd kbd-sm mr-2">f</kbd>
                    </td>
                </tr>
                <tr>
                    <th>Delete selected elements</th>
                    <td className="text-right"><kbd className="kbd kbd-sm">del</kbd></td>
                </tr>
            </tbody>
        </table>
    </div>)
}

