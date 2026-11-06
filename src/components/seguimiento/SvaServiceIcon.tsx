import { PiPackage, PiShieldCheck, PiLightning, PiPhone } from "react-icons/pi";

export const SvaServiceIcon = ({ name }: { name: string }) => {
    const lower = name.toLowerCase();

    // 1. Win TV / L1max / Streaming
    if (lower.includes('tv') || lower.includes('l1max') || lower.includes('dgo')) {
        return (
            <svg width="15" height="15" viewBox="22 54 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M24.375 59.624C24.375 59.2925 24.5067 58.9746 24.7411 58.7401C24.9755 58.5057 25.2935 58.374 25.625 58.374H34.375C34.7065 58.374 35.0245 58.5057 35.2589 58.7401C35.4933 58.9746 35.625 59.2925 35.625 59.624V65.249C35.625 65.5805 35.4933 65.8985 35.2589 66.1329C35.0245 66.3673 34.7065 66.499 34.375 66.499H25.625C25.2935 66.499 24.9755 66.3673 24.7411 66.1329C24.5067 65.8985 24.375 65.5805 24.375 65.249V59.624Z"
                    stroke="#FF5A0A"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M32.5 55.875L30 58.375L27.5 55.875"
                    stroke="#FF5A0A"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    // 2. Win Box / Equipos decodificadores
    if (lower.includes('box')) {
        return (
            <svg width="15" height="15" viewBox="22 96 15 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M27.7969 105.843C27.0483 106.001 26.3148 105.953 25.7256 105.435C25.577 105.304 25.4512 105.163 25.344 104.996L24.7708 104.101L24.321 103.388L23.4494 101.984C23.3316 101.794 23.2653 101.567 23.2656 101.342L23.2681 99.6564C23.2685 99.3681 23.4305 99.1015 23.6388 98.9096C23.8327 98.731 24.0738 98.6042 24.3366 98.5486C26.0049 98.196 27.6734 97.8714 29.3509 97.5517L31.5598 97.1306C31.8784 97.0699 32.1898 97.0628 32.5094 97.1045C32.9288 97.1592 33.3783 97.3414 33.6687 97.6534L34.651 98.7086L36.4459 100.714C36.6151 100.903 36.7334 101.155 36.7335 101.41L36.7349 103.075C36.684 103.767 36.1767 104.073 35.5426 104.207L28.917 105.608L27.7969 105.843V105.843ZM27.2148 103.569C27.4255 103.557 27.6073 103.511 27.8084 103.468L30.5766 102.876L35.5587 101.826C35.829 101.769 36.1652 101.672 36.2942 101.423C36.3626 101.292 36.3551 101.106 36.2448 100.982L34.5527 99.08L33.5359 97.9793C33.3245 97.7506 33.0737 97.5849 32.7734 97.4963C32.3785 97.3796 31.9723 97.3821 31.5665 97.4604L29.0926 97.9378L24.5501 98.8356C24.2299 98.8989 23.8823 99.0421 23.7323 99.3353C23.6362 99.5234 23.6388 99.7478 23.7651 99.9257L25.2483 102.016L26.0124 103.119C26.1209 103.276 26.2855 103.376 26.4572 103.451C26.6945 103.556 26.949 103.584 27.2145 103.569L27.2148 103.569ZM25.6863 104.885L25.6872 103.382C25.6797 103.284 25.6466 103.206 25.5965 103.125L25.007 102.234L23.5869 100.236L23.5826 101.319C23.5953 101.551 23.6666 101.763 23.7983 101.952L24.216 102.617L25.5356 104.699C25.5847 104.768 25.6217 104.836 25.6865 104.885H25.6863ZM26.2285 105.385C26.4463 105.505 26.6791 105.574 26.926 105.591C27.1612 105.607 27.3912 105.6 27.6259 105.55L30.9683 104.84L35.4962 103.882C35.6999 103.839 35.8828 103.772 36.0544 103.66C36.2684 103.521 36.4098 103.299 36.411 103.037L36.417 101.849L36.2067 101.954C36.0034 102.056 35.7909 102.11 35.5663 102.157L29.6051 103.415L27.7502 103.814C27.4949 103.869 27.2524 103.908 26.9928 103.894C26.7508 103.885 26.5217 103.838 26.301 103.742C26.1959 103.701 26.1116 103.638 26.0051 103.577L26.0022 105.098C26.0305 105.229 26.1085 105.319 26.2284 105.385L26.2285 105.385Z"
                    fill="#FF5A0A"
                    stroke="#FF5A0A"
                    strokeWidth="0.4"
                />
                <circle cx="33.41" cy="103.54" r="0.27" fill="#FF5A0A" stroke="#FF5A0A" strokeWidth="0.4" />
            </svg>
        );
    }

    // 3. Mesh / Wifi / Inalámbrico
    if (lower.includes('mesh') || lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('ap')) {
        return (
            <svg width="15" height="15" viewBox="22 134 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30 145.25H30.0063" stroke="#FF5A0A" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28.2344 143.483C28.7032 143.014 29.339 142.751 30.0019 142.751C30.6648 142.751 31.3006 143.014 31.7694 143.483" stroke="#FF5A0A" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M26.4648 141.715C26.9291 141.25 27.4803 140.882 28.087 140.631C28.6936 140.379 29.3438 140.25 30.0005 140.25C30.6571 140.25 31.3073 140.379 31.9139 140.631C32.5206 140.882 33.0718 141.25 33.5361 141.715" stroke="#FF5A0A" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M24.6953 139.947C27.6241 137.018 32.3728 137.018 35.3203 139.947" stroke="#FF5A0A" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    // 4. Telefonía
    if (lower.includes('fono') || lower.includes('phone') || lower.includes('tel')) {
        return <PiPhone className="w-3.5 h-3.5 text-[#FF5A0A]" />;
    }

    // 5. Ciberseguridad / Firewall / VPN
    if (lower.includes('antivirus') || lower.includes('seguridad') || lower.includes('firewall') || lower.includes('vpn')) {
        return <PiShieldCheck className="w-3.5 h-3.5 text-[#FF5A0A]" />;
    }

    // 6. Promociones de velocidad / Duplica
    if (lower.includes('aumento') || lower.includes('duplica') || lower.includes('velocidad')) {
        return <PiLightning className="w-3.5 h-3.5 text-[#FF5A0A]" />;
    }

    // 7. Traslado / Reubicación
    if (lower.includes('traslado') || lower.includes('reubic')) {
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#FF5A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 22V12H15V22" stroke="#FF5A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    // 8. Cambio de ONT / Modem / Router
    if (lower.includes('ont') || lower.includes('router') || lower.includes('modem') || lower.includes('módem')) {
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="14" width="20" height="7" rx="2" stroke="#FF5A0A" strokeWidth="1.5" />
                <path d="M6 18H6.01M10 18H10.01" stroke="#FF5A0A" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 14V8M19 14V5M13 14V11" stroke="#FF5A0A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        );
    }

    // 9. Recableado / Cableado / UTP
    if (lower.includes('cable') || lower.includes('recableado') || lower.includes('utp') || lower.includes('patch')) {
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="#FF5A0A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        );
    }

    return <PiPackage className="w-3.5 h-3.5 text-[#FF5A0A]" />;
};