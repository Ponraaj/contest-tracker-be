import {  initializeScheduler } from './controllers/contestController';


// Initialize the scheduler when the module is imported
initializeScheduler();

// If you need to handle errors at the top level
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});