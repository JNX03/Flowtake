import { CodeBracketSquareIcon } from "@heroicons/react/16/solid"

export default function RequestFeatureButton() {
    return (<a className="mt-1 btn btn-xs" href="https://github.com/JNX03/Flowtake/issues" target="_blank" rel="noreferrer">
        <CodeBracketSquareIcon className="size-4" />
        Request a feature
    </a>)
}

