import ToastMessage from "../../../components/ToastMessage/ToastMessage";
import { useToastMessage } from "../../../hooks/useToastMessage";
import AuthPageLayout from "../../Auth/AuthPageLayout";
import AuthForm from "../../Auth/components/AuthForm";
import { useAuth } from "../../../contexts/AuthContext";
import { Navigate } from "react-router-dom";

const ResidentRegisterPage = () => {
    const { message, isFailed, isVisible, showToastMessage, closeToastMessage } = useToastMessage("", false, false);
    const { user, loading } = useAuth();

    if (!loading && user && !isVisible) {
        return <Navigate to={user.user?.role === "resident" ? "/resident/home" : "/dashboard"} replace />;
    }

    return (
        <>
            <ToastMessage
                message={message}
                isFailed={isFailed}
                isVisible={isVisible}
                onClose={closeToastMessage}
                overlay
                size="large"
            />
            <AuthPageLayout>
                <AuthForm message={showToastMessage} defaultRegistrationOpen={true} />
            </AuthPageLayout>
        </>
    );
};

export default ResidentRegisterPage;
