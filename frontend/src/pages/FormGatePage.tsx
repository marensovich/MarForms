import {useParams} from "react-router-dom";
import {useFormAccess} from "../hooks/useFormAccess";
import LoadingScreen from "../components/LoadingScreen";
import {
    FormErrorState,
    FormInactiveState,
    FormNotFoundState,
    NotAuthenticatedState,
    NotInGuildState,
} from "../components/AccessStates";
import FormRenderer from "../components/form/FormRenderer";

export default function FormGatePage() {
    const {formId} = useParams<{ formId: string }>();
    const {status, form} = useFormAccess(formId ?? "");

    switch (status) {
        case "loading":
            return <LoadingScreen label="Checking access..."/>;
        case "not_authenticated":
            return <NotAuthenticatedState formId={formId}/>;
        case "not_in_guild":
            return <NotInGuildState/>;
        case "form_inactive":
            return <FormInactiveState/>;
        case "not_found":
            return <FormNotFoundState/>;
        case "error":
            return <FormErrorState/>;
        case "granted":
            return form ? (
                <FormRenderer form={form}/>
            ) : (
                <LoadingScreen label="Loading form..."/>
            );
    }
}