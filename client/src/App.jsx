import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { RentPage } from "./pages/RentPage";
import { ListPage } from "./pages/ListPage";
import DevPage from "./pages/DevPage";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/rent" element={<RentPage />} />
                <Route path="/list" element={<ListPage />} />
                <Route path="/dev" element={<DevPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
