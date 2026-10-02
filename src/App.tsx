import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';

const Home = lazy(() => import('./pages/Home'));
const CreateExam = lazy(() => import('./pages/CreateExam'));
const Generating = lazy(() => import('./pages/Generating'));
const ExamPreview = lazy(() => import('./pages/ExamPreview'));
const TakeExam = lazy(() => import('./pages/TakeExam'));
const ExamResult = lazy(() => import('./pages/ExamResult'));
const MyExams = lazy(() => import('./pages/MyExams'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateExam />} />
          <Route path="/generating/:examId" element={<Generating />} />
          <Route path="/preview/:examId" element={<ExamPreview />} />
          <Route path="/my-exams" element={<MyExams />} />
          <Route path="/result/:resultId" element={<ExamResult />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        {/* CBT exam runs outside the normal layout */}
        <Route path="/exam/:examId" element={<TakeExam />} />
      </Routes>
    </Suspense>
  );
}
