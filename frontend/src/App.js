import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Register from "./Register"; // นำเข้า Register
import Home from "./home"; // นำเข้า Home
import Report from "./AdminReport"; // นำเข้า Report
import AdminStatSlip from "./Stat-slip"; // ชื่อ component ต้องตรงกับที่ export
import ImageQueue from "./ImageQueue";
import TimeHistory from "./TimeHistory";
import CheckHistory from "./CheckHistory";  // นำเข้า CheckHistory
import LuckyWheel from "./LuckyWheel.js";
import Giftsetting from "./Giftsetting";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Register />} /> {/* หน้าแรกสุด */}
        <Route path="/home" element={<Home />} /> {/* หน้า Home */}
        <Route path="/report" element={<Report />} /> {/* หน้า Report */}
        <Route path="/stat-slip" element={<AdminStatSlip />} />
        <Route path="/image-queue" element={<ImageQueue />} />
        <Route path="/TimeHistory" element={<TimeHistory />} />
        <Route path="/check-history" element={<CheckHistory />} /> {/* เส้นทางใหม่ */}
        <Route path="/lucky-wheel" element={<LuckyWheel />} />
        <Route path="/gift-setting" element={<Giftsetting />} />
      </Routes>
    </Router>
  );
}

export default App;
