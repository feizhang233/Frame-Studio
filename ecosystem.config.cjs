module.exports = {
  apps: [
    {
      name: 'frame2d',
      cwd: '/home/fei/Solver/2D-Frame-Project',
      script: '.venv/bin/uvicorn',
      args: 'frame2d.api:app --host 0.0.0.0 --port 8002',
      interpreter: 'none',
      env: {
        FRAME2D_DATABASE_URL: process.env.FRAME2D_DATABASE_URL
          || 'mysql://frame2d:frame2d@127.0.0.1:3306/frame2d',
        MPLBACKEND: 'Agg',
        MPLCONFIGDIR: '/home/fei/Solver/2D-Frame-Project/data/matplotlib',
      },
      max_restarts: 20,
      min_uptime: '5s',
    },
  ],
};
