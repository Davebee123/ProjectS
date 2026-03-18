interface IconSlotProps {
  label?: string;
  itemName?: string;
  size?: number;
  active?: boolean;
  icon?: string;
  variant?: "equipment" | "backpack";
  onClick?: () => void;
}

export function IconSlot({
  label,
  itemName,
  size = 36,
  active = false,
  icon,
  variant = "equipment",
  onClick,
}: IconSlotProps) {
  const shellImage =
    variant === "backpack"
      ? "/icons/slots/backpack-shell.png"
      : "/icons/slots/equipment-shell.png";

  return (
    <button
      type="button"
      className={`icon-slot icon-slot-${variant} ${active ? "is-active" : ""} ${itemName ? "is-filled" : ""}`}
      style={{ width: size, height: size, backgroundImage: `url("${shellImage}")` }}
      onClick={onClick}
      title={itemName ? `${label ? label + ": " : ""}${itemName}` : label ?? "Empty"}
    >
      <span className="icon-slot-content">
        {itemName ? (
          <span className="icon-slot-letter">{itemName[0].toUpperCase()}</span>
        ) : icon ? (
          <img className="icon-slot-placeholder" src={icon} alt={label ?? ""} />
        ) : null}
      </span>
    </button>
  );
}
