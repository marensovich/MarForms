import {Outlet} from "react-router-dom";
import {useAuth} from "../hooks/useAuth";
import AccessScreen from "../components/access/AccessScreen";

/**
 * The panel's door (ТЗ 6.3): a timed-out user sees why and until when, and
 * still reaches their own submissions and the public forms.
 */
export default function PanelGate() {
    const {user} = useAuth();
    if (user?.timeout) {
        return <AccessScreen code="ACCOUNT_RESTRICTED"
                             details={{until: user.timeout.until, reason: user.timeout.reason ?? undefined}}/>;
    }
    return <Outlet/>;
}
