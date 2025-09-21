import { useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import "../index.css";

export default function Navbar() {
  const navigate = useNavigate();

  const [activeIndex, setActiveIndex] = useState(null);

  // Mapeamento de ícones para rotas
  const iconRoutes = [
    { icon: "bxs:dashboard", path: "/dashboard" },
    { icon: "mingcute:stock-fill", path: "/materia-prima" },
    { icon: "ix:product", path: "/produtos" },
    { icon: "mingcute:user-2-fill", path: "/produtos" },
    { icon: "solar:exit-bold", path: "/login" }
  ];

  const handleIconClick = (path, index) => {
    setActiveIndex(index);
    navigate(path);
  };

  return (
    <div className="navbar">
      <div className="navbar-content">
        {iconRoutes.map((item, index) => (
          <Icon
            key={index}
            icon={item.icon}
            width="34"
            height="34"
            className={activeIndex === index ? "active" : ""}
            onClick={() => handleIconClick(item.path, index)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </div>
    </div>
  );
}