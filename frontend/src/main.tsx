import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {AuthProvider} from "./auth/AuthProvider";
import App from "./App";
import "./index.css";
import "./i18n";
import LanguageLoader from "./components/LanguageLoader";
import {watchSystemTheme} from "./theme/theme";
import {ToastProvider} from "./ui";

watchSystemTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <LanguageLoader>
            <ToastProvider>
                <AuthProvider>
                    <App/>
                </AuthProvider>
            </ToastProvider>
        </LanguageLoader>
    </BrowserRouter>
);
