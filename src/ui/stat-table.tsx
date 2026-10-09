import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type CellProps = { children?: ReactNode; scope?: string | undefined; id?: string | undefined; headers?: string; className?: string; label?: string; metric?: string };
const elements = (children: ReactNode) => Children.toArray(children).filter(isValidElement<CellProps>);
function labelText(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (!isValidElement<CellProps>(child)) return "";
    return child.props.label ?? child.props.metric ?? labelText(child.props.children);
  }).join("");
}

/** One semantic table: wide screens use columns; narrow screens use labelled rows.
 * No duplicate data tree, hidden metrics or horizontal scroll container. */
export function StatTable({ children }: { children: ReactNode }) {
  const id = useId();
  const sections = elements(children);
  const header = sections.find(section => section.type === "thead");
  const columns = elements(elements(header?.props.children)[0]?.props.children);
  const labels = columns.map(column => labelText(column.props.children));
  const renderRow = (row: ReactElement<CellProps>, rowIndex: number) => {
    const cells = elements(row.props.children);
    const rowHeader = cells.findIndex(cell => cell.type === "th");
    return cloneElement(row, { children: cells.map((cell, index) => cloneElement(cell, {
      id: index === rowHeader ? `${id}-row-${rowIndex}` : undefined,
      scope: index === rowHeader ? "row" : undefined,
      headers: index === rowHeader ? `${id}-col-${index}` : `${id}-col-${index}${rowHeader >= 0 ? ` ${id}-row-${rowIndex}` : ""}`,
      className: index === rowHeader ? "stat-table-identity" : "stat-table-value",
      children: <>{index !== rowHeader && <span className="stat-table-label" aria-hidden="true">{labels[index]}</span>}<span className="stat-table-content">{cell.props.children}</span></>,
    })) });
  };
  return <table className="stat-table" role="table">{sections.map(section => section.type === "thead"
    ? cloneElement(section, { children: <tr>{columns.map((column, index) => cloneElement(column, { id: `${id}-col-${index}`, scope: "col" }))}</tr> })
    : section.type === "tbody" ? cloneElement(section, { children: elements(section.props.children).map(renderRow) }) : section)}</table>;
}
