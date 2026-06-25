import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {AuthProvider} from "./auth/AuthProvider";
import App from "./App";
import "./index.css";
import "./i18n";
import LanguageLoader from "./components/LanguageLoader";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <LanguageLoader>
            <AuthProvider>
                <App/>
            </AuthProvider>
        </LanguageLoader>
    </BrowserRouter>
);
