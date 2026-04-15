import { CodeBracketSquareIcon } from "@heroicons/react/16/solid"

export default function RequestFeatureButton() {
    return (<button className="btn btn-ghost btn-xs"
        onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake/issues")}>
        <CodeBracketSquareIcon className="size-4" />
        <span className="hidden lg:inline">Request a feature</span>
    </button>)
}

