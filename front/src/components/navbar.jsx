import { useState } from "react";
import { Icon } from "@iconify/react";
import "../index.css";

export default function Navbar() {
  const [activeIndex, setActiveIndex] = useState(null);

  const icons = [
    "bxs:dashboard",
    "mingcute:stock-fill",
    "mingcute:user-2-fill",
    "solar:exit-bold"
  ];

  return (
    <div className="navbar">
      <div className="navbar-content">
        {icons.map((iconName, index) => (
          <Icon
            key={index}
            icon={iconName}
            width="34"
            height="34"
            className={activeIndex === index ? "active" : ""}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}