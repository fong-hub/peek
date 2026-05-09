import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface Props {
  content: string;
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(true);

  if (value === null) {
    return <span className="text-text-muted">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-accent">{value ? "true" : "false"}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-warning">{value}</span>;
  }

  if (typeof value === "string") {
    return <span className="text-success">"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-text-secondary">[]</span>;
    }
    return (
      <span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center hover:text-accent transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-text-secondary ml-0.5">
            [{value.length}]
          </span>
        </button>
        {expanded && (
          <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
            {value.map((item, index) => (
              <div key={index} className="flex items-start">
                <span className="text-text-muted mr-2 select-none">{index}:</span>
                <JsonValue value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-text-secondary">{"{}"}</span>;
    }
    return (
      <span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center hover:text-accent transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-text-secondary ml-0.5">
            {"{"}{entries.length}{"}"}
          </span>
        </button>
        {expanded && (
          <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-start">
                <span className="text-text-primary mr-2">"{key}"</span>
                <span className="text-text-muted mr-2">:</span>
                <JsonValue value={val} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

export default function JsonPreviewer({ content }: Props) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  if (parsed === null) {
    return (
      <div className="w-full h-full overflow-auto p-6">
        <div className="text-error mb-2">无效的 JSON</div>
        <pre className="text-text-secondary whitespace-pre-wrap">{content}</pre>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-6 font-mono text-sm">
      <JsonValue value={parsed} />
    </div>
  );
}
