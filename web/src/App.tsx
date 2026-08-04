import { useDesktopModeInitializer } from './providers/layout';
import { init } from './init';
import { LoadingOverlay } from './components/loading';
import { MainScreen } from './pages/main-screen';
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export default function App() {
  useDesktopModeInitializer();

  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string[] | null>(null);

  useEffect(() => {
    init()
      .then((l) => {
        if (l.length === 0) {
          return;
        }
        console.log(l);
        setError(l);
      })
      .catch((e: unknown) => {
        console.error('Initialization failed:', e);
        setError(['未知错误']);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  return (
    <>
      {initializing && <LoadingOverlay />}
      <Dialog
        open={error !== null}
        onClose={() => {
          setError(null);
        }}
      >
        <DialogTitle>初始化失败！</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>以下系统初始化失败：</DialogContentText>
          {error?.map((line) => (
            <DialogContentText key={line} sx={{ color: 'text.primary' }}>
              - {line}
            </DialogContentText>
          ))}
          <DialogContentText sx={{ mt: 1 }}>可尝试清除网页缓存后刷新重试。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setError(null);
            }}
            autoFocus
          >
            确认
          </Button>
        </DialogActions>
      </Dialog>
      <MainScreen />
    </>
  );
}
