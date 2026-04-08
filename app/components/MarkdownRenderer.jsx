import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

const components = {
    a: ({ href, children }) => (
        <button className="link link-primary"
            onClick={(e) => { e.preventDefault(); window.electron.ipcRenderer.invoke("open-url-in-browser", href) }}>
            {children}
        </button>
    ),
    code: ({ inline, className, children }) => {
        if (inline) {
            return <code className="bg-base-300 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
        }
        return (
            <pre className="bg-base-300 rounded-box p-3 overflow-x-auto">
                <code className={`text-sm font-mono ${className || ""}`}>{children}</code>
            </pre>
        )
    },
    blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-primary/40 pl-3 text-base-content/60 italic">{children}</blockquote>
    ),
    table: ({ children }) => (
        <div className="overflow-x-auto"><table className="table table-sm">{children}</table></div>
    ),
    th: ({ children }) => <th className="text-base-content/80 font-semibold">{children}</th>,
    td: ({ children }) => <td className="text-base-content/70">{children}</td>,
    img: ({ src, alt }) => (
        <img src={src} alt={alt || ""} className="max-w-full rounded" loading="lazy" />
    ),
    input: ({ type, checked, ...props }) => {
        if (type === "checkbox") {
            return <input type="checkbox" checked={checked} readOnly className="checkbox checkbox-xs mr-1.5 align-middle" />
        }
        return <input type={type} {...props} />
    },
}

export default function MarkdownRenderer({ children, className }) {
    return (
        <div className={`prose prose-sm prose-headings:text-base-content prose-p:text-base-content/70 prose-li:text-base-content/70 prose-strong:text-base-content/80 prose-a:text-primary max-w-none ${className || ""}`}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
                {children}
            </Markdown>
        </div>
    )
}
