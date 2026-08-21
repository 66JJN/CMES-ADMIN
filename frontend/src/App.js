import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ShopProvider } from "./contexts/ShopContext"; // 🔥 Multi-tenant Context
import { OBSControlProvider } from "./contexts/OBSControlContext";
import Login from "./pages/Login/Login"; // นำเข้า Login page
import Home from "./pages/Home/Home"; // นำเข้า Home page
import Report from "./components/dashboard/AdminReport"; // นำเข้า Report
import AdminStatSlip from "./components/Stat-slip"; // ชื่อ component ต้องตรงกับที่ export
import ImageQueue from "./components/dashboard/ImageQueue";
import TimeHistoryPage from "./pages/TimeHistory/TimeHistoryPage.jsx";
import CheckHistory from "./components/dashboard/CheckHistory";  // นำเข้า CheckHistory
import LuckyWheel from "./components/dashboard/LuckyWheel";
import GiftManagement from "./components/dashboard/GiftManagement";
import EditProfilePage from "./pages/EditProfile/EditProfilePage.jsx";

function App() {
  return (
    <ShopProvider> {/* 🔥 Wrap ด้วย ShopProvider */}
      <OBSControlProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} /> {/* หน้าแรกสุด */}
            <Route path="/home" element={<Home />} /> {/* หน้า Home */}
            <Route path="/report" element={<Report />} /> {/* หน้า Report */}
            <Route path="/stat-slip" element={<AdminStatSlip />} />
            <Route path="/image-queue" element={<ImageQueue />} />
            <Route path="/TimeHistory" element={<TimeHistoryPage />} />
            <Route path="/check-history" element={<CheckHistory />} /> {/* เส้นทางใหม่ */}
            <Route path="/lucky-wheel" element={<LuckyWheel />} />
            <Route path="/gift-setting" element={<GiftManagement />} />
            <Route path="/edit-profile" element={<EditProfilePage />} />
          </Routes>
        </Router>
      </OBSControlProvider>
    </ShopProvider>
  );
}

export default App;
