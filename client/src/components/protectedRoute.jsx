import {Navigate,useLocation} from 'react-router-dom';
import {useAuth} from '../contexts/authUserContext';

const ProtectedRoute=({children})=>{
    const {user,loading}=useAuth();
    const location=useLocation();

    if(loading){
        return <p>Loading...</p>
    }
    if(!user){
        return <Navigate to={{pathname:'/',state:{from:location}}}/>
    }
    return children;
}

export default ProtectedRoute;