import React, { useState, useEffect } from 'react';
import { Task } from '../../types';
import { TimeTracker } from '../../services/timeTracker';
import { formatTime } from '../../utils/formatTime';

interface TimerDisplayProps {
    task: Task;
    className?: string;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ task, className }) => {
    const [seconds, setSeconds] = useState(TimeTracker.calculateTotalSeconds(task));

    useEffect(() => {
        // Initial sync
        setSeconds(TimeTracker.calculateTotalSeconds(task));

        // Check if anyone is active on this task
        const isActive = task.activeUserIds && task.activeUserIds.length > 0;
        
        let interval: any;
        if (isActive) {
            interval = setInterval(() => {
                setSeconds(TimeTracker.calculateTotalSeconds(task));
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [task]); // Re-subscribe if task object updates (e.g. from server poll)

    return <span className={className}>{formatTime(seconds)}</span>;
};