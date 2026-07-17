module.exports = {
  apps: [
    {
      name: 'frame2d',
      cwd: '/home/fei/Solver/2D-Frame-Project',
      script: '.venv/bin/uvicorn',
      args: 'frame2d.api:app --host 0.0.0.0 --port 8002',
      interpreter: 'none',
      env: {
        FRAME2D_DB_PATH: '/home/fei/Solver/2D-Frame-Project/data/frame2d.sqlite3',
        MPLBACKEND: 'Agg',
        MPLCONFIGDIR: '/home/fei/Solver/2D-Frame-Project/data/matplotlib',
      },
      max_restarts: 20,
      min_uptime: '5s',
    },
  ],
};
