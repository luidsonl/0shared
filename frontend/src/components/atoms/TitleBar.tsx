interface TitleBarProps {
  title: string;
  active?: boolean;
}

export default function TitleBar({ title, active = true }: TitleBarProps) {
  return (
    <div className={active ? "title-bar" : "title-bar inactive"}>
      <div className="title-bar-text">{title}</div>
      <div className="title-bar-controls">
        <button type="button" aria-label="Minimize" />
        <button type="button" aria-label="Maximize" />
        <button type="button" aria-label="Close" />
      </div>
    </div>
  );
}
