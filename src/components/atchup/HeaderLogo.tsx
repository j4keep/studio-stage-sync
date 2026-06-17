import atchupLogo from "@/assets/atchup-logo-purple.png";
import NotificationBell from "./NotificationBell";
import MessagesIcon from "./MessagesIcon";

const HeaderLogo = () => {
  return (
    <div className="flex items-center justify-between py-4">
      <img 
        src={atchupLogo} 
        alt="Atchup" 
        className="h-16 w-auto object-contain"
      />
      <div className="flex items-center gap-2">
        <MessagesIcon />
        <NotificationBell />
      </div>
    </div>
  );
};

export default HeaderLogo;