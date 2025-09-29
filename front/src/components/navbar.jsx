import { useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import "../index.css";

export default function Navbar() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Mapeamento de ícones para rotas e tooltips
  const iconRoutes = [
    {
      icon: "bxs:dashboard",
      path: "/dashboard",
      tooltip: "Dashboard"
    },
    {
      icon: "mingcute:stock-fill",
      path: "/materia-prima",
      tooltip: "Matérias Primas"
    },
    {
      icon: "ix:product",
      path: "/produtos",
      tooltip: "Produtos"
    },
    // {
    //   icon: "mingcute:user-2-fill",
    //   path: "/perfil",
    //   tooltip: "Perfil"
    // },
    // {
    //   icon: "solar:exit-bold",
    //   path: "/login",
    //   tooltip: "Sair"
    // }
  ];

  const handleIconClick = (path, index) => {
    setActiveIndex(index);
    navigate(path);
  };

  const handleMouseEnter = (index) => {
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="navbar">
      <div className="navbar-content">
        {iconRoutes.map((item, index) => (
          <div
            key={index}
            className="navbar-icon-container"
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            <Icon
              icon={item.icon}
              width="44"
              height="44"
              className={activeIndex === index ? "active" : ""}
              onClick={() => handleIconClick(item.path, index)}
              style={{ cursor: "pointer" }}
            />

            {/* Tooltip */}
            {hoveredIndex === index && (
              <div className="navbar-tooltip">
                {item.tooltip}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}