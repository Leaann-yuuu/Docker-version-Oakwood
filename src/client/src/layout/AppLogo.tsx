import { Link } from "react-router-dom";
import oakwoodLogo from "../assets/img/oakwood-logo.png";

type AppLogoProps = {
    homePath?: string;
};

const AppLogo = ({ homePath = "/dashboard" }: AppLogoProps) => (
    <Link to={homePath} className="flex items-center gap-3 group cursor-pointer">
        <div className="relative shrink-0 overflow-visible">
            <img
                src={oakwoodLogo}
                alt="Oakwood Logo"
                className="h-10 w-auto object-contain transition-all duration-300 group-hover:scale-105 drop-shadow-xs"
            />
        </div>
    </Link>
);

export default AppLogo;
