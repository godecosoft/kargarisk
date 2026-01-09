import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import WithdrawalsPage from './pages/WithdrawalsPage';
import AutoControlPage from './pages/AutoControlPage';
import './index.css';

function App() {
  const [currentPage, setCurrentPage] = useState('withdrawals');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);

  const handleViewDetail = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setCurrentPage('detail');
  };

  const handleBackToList = () => {
    setSelectedWithdrawal(null);
    setCurrentPage('withdrawals');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'withdrawals':
        return <WithdrawalsPage onViewDetail={handleViewDetail} />;
      case 'autocontrol':
        return <AutoControlPage />;
      case 'detail':
        return <AutoControlPage
          singleWithdrawal={selectedWithdrawal}
          onBack={handleBackToList}
        />;
      default:
        return <WithdrawalsPage onViewDetail={handleViewDetail} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
