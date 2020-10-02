import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import DescriptionIcon from '@material-ui/icons/Description';
import CircularProgress from '@material-ui/core/CircularProgress';

export default function NewDownloadButton({ displayText, getData, fileName }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);

    const response = await getData();
    const blob = new Blob([JSON.stringify(response)], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = fileName();
    a.href = window.URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    a.remove();

    setLoading(false);
  }

  return (
    <Button
      onClick={!loading && download}
      startIcon={!loading && <DescriptionIcon />}
      variant="contained"
      size="large"
      color="secondary"
    >
      {loading ? <CircularProgress /> : displayText}
    </Button>
  );
}
