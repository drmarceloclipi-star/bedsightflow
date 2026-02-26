import { Outlet } from 'react-router-dom';

export default function TvLayout() {
    return (
        <div className="tv-layout h-screen w-full flex flex-col">
            <Outlet />
        </div>
    );
}
