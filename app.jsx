const { useState, useCallback, useMemo, useEffect } = React;

// ==================== UTILITY FUNCTIONS ====================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Parse a date string (YYYY-MM-DD) or return null
function parseDate(dateStr) {
    if (!dateStr || dateStr === 'none') return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Format a Date object to YYYY-MM-DD
function formatDate(date) {
    if (!date) return 'none';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get last day of month
function getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// Get quarter from month (0-indexed)
function getQuarterFromMonth(month) {
    return Math.floor(month / 3);
}

// Get months in a quarter (0-indexed quarters, returns 0-indexed months)
function getMonthsInQuarter(quarter) {
    return [quarter * 3, quarter * 3 + 1, quarter * 3 + 2];
}

// ==================== TIMEFRAME DATA HELPERS ====================

// Parse timeframe JSON into internal state
function parseTimeframe(timeframe) {
    if (!timeframe) {
        return {
            mode: 'high-level',
            granularity: 'none',
            selectedYears: [],
            selectedQuarters: [], // {year, quarter}
            selectedMonths: [], // {year, month}
            startDate: null,
            endDate: null
        };
    }

    const { startDate, endDate, granularity } = timeframe;
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    // No dates set
    if (!start && !end) {
        return {
            mode: 'high-level',
            granularity: 'none',
            selectedYears: [],
            selectedQuarters: [],
            selectedMonths: [],
            startDate: null,
            endDate: null
        };
    }

    // Specific date mode (granularity is 'none')
    if (granularity === 'none') {
        return {
            mode: 'specific',
            granularity: 'none',
            selectedYears: [],
            selectedQuarters: [],
            selectedMonths: [],
            startDate: start,
            endDate: end
        };
    }

    // High-level modes
    if (granularity === 'year') {
        const years = [];
        if (start && end) {
            for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
                years.push(y);
            }
        }
        return {
            mode: 'high-level',
            granularity: 'year',
            selectedYears: years,
            selectedQuarters: [],
            selectedMonths: [],
            startDate: null,
            endDate: null
        };
    }

    if (granularity === 'quarter') {
        const quarters = [];
        if (start && end) {
            let currentYear = start.getFullYear();
            let currentQuarter = getQuarterFromMonth(start.getMonth());
            const endYear = end.getFullYear();
            const endQuarter = getQuarterFromMonth(end.getMonth());

            while (currentYear < endYear || (currentYear === endYear && currentQuarter <= endQuarter)) {
                quarters.push({ year: currentYear, quarter: currentQuarter });
                currentQuarter++;
                if (currentQuarter > 3) {
                    currentQuarter = 0;
                    currentYear++;
                }
            }
        }
        return {
            mode: 'high-level',
            granularity: 'quarter',
            selectedYears: [],
            selectedQuarters: quarters,
            selectedMonths: [],
            startDate: null,
            endDate: null
        };
    }

    if (granularity === 'month') {
        const months = [];
        if (start && end) {
            let currentYear = start.getFullYear();
            let currentMonth = start.getMonth();
            const endYear = end.getFullYear();
            const endMonth = end.getMonth();

            while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                months.push({ year: currentYear, month: currentMonth });
                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
            }
        }
        return {
            mode: 'high-level',
            granularity: 'month',
            selectedYears: [],
            selectedQuarters: [],
            selectedMonths: months,
            startDate: null,
            endDate: null
        };
    }

    return {
        mode: 'high-level',
        granularity: 'none',
        selectedYears: [],
        selectedQuarters: [],
        selectedMonths: [],
        startDate: null,
        endDate: null
    };
}

// Convert internal state to timeframe JSON
function stateToTimeframe(state) {
    const { mode, granularity, selectedYears, selectedQuarters, selectedMonths, startDate, endDate } = state;

    // Specific date mode
    if (mode === 'specific') {
        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            granularity: 'none'
        };
    }

    // High-level mode
    if (granularity === 'year' && selectedYears.length > 0) {
        const sortedYears = [...selectedYears].sort((a, b) => a - b);
        const startYear = sortedYears[0];
        const endYear = sortedYears[sortedYears.length - 1];
        return {
            startDate: `${startYear}-01-01`,
            endDate: `${endYear}-12-31`,
            granularity: 'year'
        };
    }

    if (granularity === 'quarter' && selectedQuarters.length > 0) {
        const sorted = [...selectedQuarters].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.quarter - b.quarter;
        });
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const startMonth = first.quarter * 3;
        const endMonth = last.quarter * 3 + 2;
        return {
            startDate: `${first.year}-${String(startMonth + 1).padStart(2, '0')}-01`,
            endDate: `${last.year}-${String(endMonth + 1).padStart(2, '0')}-${getLastDayOfMonth(last.year, endMonth)}`,
            granularity: 'quarter'
        };
    }

    if (granularity === 'month' && selectedMonths.length > 0) {
        const sorted = [...selectedMonths].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        return {
            startDate: `${first.year}-${String(first.month + 1).padStart(2, '0')}-01`,
            endDate: `${last.year}-${String(last.month + 1).padStart(2, '0')}-${getLastDayOfMonth(last.year, last.month)}`,
            granularity: 'month'
        };
    }

    // Nothing selected
    return {
        startDate: 'none',
        endDate: 'none',
        granularity: 'none'
    };
}

// Format timeframe for display
function formatTimeframeDisplay(timeframe) {
    if (!timeframe) return 'Not set';

    const { startDate, endDate, granularity } = timeframe;

    if (startDate === 'none' && endDate === 'none') {
        return 'Not set';
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    // Specific date
    if (granularity === 'none') {
        if (start && !end) {
            return `${FULL_MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
        }
        if (start && end) {
            const startStr = `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
            const endStr = `${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
            return `${startStr} - ${endStr}`;
        }
        return 'Not set';
    }

    // Year granularity
    if (granularity === 'year') {
        const startYear = start?.getFullYear();
        const endYear = end?.getFullYear();
        if (startYear === endYear) {
            return `${startYear}`;
        }
        return `${startYear} - ${endYear}`;
    }

    // Quarter granularity
    if (granularity === 'quarter') {
        const startQ = `Q${getQuarterFromMonth(start.getMonth()) + 1} ${start.getFullYear()}`;
        const endQ = `Q${getQuarterFromMonth(end.getMonth()) + 1} ${end.getFullYear()}`;
        if (startQ === endQ) {
            return startQ;
        }
        return `${startQ} - ${endQ}`;
    }

    // Month granularity
    if (granularity === 'month') {
        const startM = `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
        const endM = `${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
        if (startM === endM) {
            return startM;
        }
        return `${startM} - ${endM}`;
    }

    return 'Not set';
}

// ==================== ICONS ====================

const CircleIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeDasharray="3 3"/>
    </svg>
);

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
);

const ChevronLeft = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polyline points="15 18 9 12 15 6"/>
    </svg>
);

const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <polyline points="9 18 15 12 9 6"/>
    </svg>
);

const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
    </svg>
);

// ==================== COMPONENTS ====================

function ModeToggle({ mode, onChange }) {
    return (
        <div className="mode-toggle">
            <button
                className={`mode-button ${mode === 'high-level' ? 'active' : ''}`}
                onClick={() => onChange('high-level')}
            >
                <CircleIcon />
                HIGH-LEVEL
            </button>
            <button
                className={`mode-button ${mode === 'specific' ? 'active' : ''}`}
                onClick={() => onChange('specific')}
            >
                <CalendarIcon />
                SPECIFIC
            </button>
        </div>
    );
}

function SectionHeader({ title }) {
    return (
        <div className="section-header">
            <span>{title}</span>
        </div>
    );
}

function YearSelector({ selectedYears, visibleYearStart, onToggleYear, onNavigate, disabled }) {
    const years = [visibleYearStart, visibleYearStart + 1];

    return (
        <div className="selection-row">
            <button className="nav-button" onClick={() => onNavigate(-2)}>
                <ChevronLeft />
            </button>
            <div className="items-container">
                {years.map(year => (
                    <button
                        key={year}
                        className={`selection-item ${selectedYears.includes(year) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && onToggleYear(year)}
                    >
                        {year}
                    </button>
                ))}
            </div>
            <button className="nav-button" onClick={() => onNavigate(2)}>
                <ChevronRight />
            </button>
        </div>
    );
}

function QuarterSelector({ selectedQuarters, visibleYear, onToggleQuarter, onNavigate, disabled }) {
    const isSelected = (quarter) => {
        return selectedQuarters.some(q => q.year === visibleYear && q.quarter === quarter);
    };

    return (
        <>
            <SectionHeader title="QUARTERS" />
            <div className="selection-row">
                <button className="nav-button" onClick={() => onNavigate(-1)}>
                    <ChevronLeft />
                </button>
                <span className="year-label">{visibleYear}</span>
                <div className="items-container">
                    {QUARTERS.map((label, index) => (
                        <button
                            key={index}
                            className={`selection-item ${isSelected(index) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                            onClick={() => !disabled && onToggleQuarter(visibleYear, index)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button className="nav-button" onClick={() => onNavigate(1)}>
                    <ChevronRight />
                </button>
            </div>
        </>
    );
}

function MonthSelector({ selectedMonths, visibleYear, visibleMonthStart, onToggleMonth, onNavigate, disabled }) {
    const visibleMonths = [];
    for (let i = 0; i < 6; i++) {
        visibleMonths.push((visibleMonthStart + i) % 12);
    }

    const isSelected = (month) => {
        return selectedMonths.some(m => m.year === visibleYear && m.month === month);
    };

    return (
        <>
            <SectionHeader title="MONTHS" />
            <div className="selection-row">
                <button className="nav-button" onClick={() => onNavigate(-6)}>
                    <ChevronLeft />
                </button>
                <span className="year-label">{visibleYear}</span>
                <div className="items-container">
                    {visibleMonths.map((month) => (
                        <button
                            key={month}
                            className={`selection-item ${isSelected(month) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                            onClick={() => !disabled && onToggleMonth(visibleYear, month)}
                        >
                            {MONTHS[month]}
                        </button>
                    ))}
                </div>
                <button className="nav-button" onClick={() => onNavigate(6)}>
                    <ChevronRight />
                </button>
            </div>
        </>
    );
}

function Calendar({ year, month, selectedStart, selectedEnd, onSelectDate, onNavigate }) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getLastDayOfMonth(year, month);
    const prevMonthDays = getLastDayOfMonth(year, month - 1);

    const days = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push({
            day: prevMonthDays - i,
            month: month - 1,
            year: month === 0 ? year - 1 : year,
            isOtherMonth: true
        });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            day: i,
            month,
            year,
            isOtherMonth: false
        });
    }

    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({
            day: i,
            month: month + 1,
            year: month === 11 ? year + 1 : year,
            isOtherMonth: true
        });
    }

    const isSelected = (dayInfo) => {
        if (!selectedStart && !selectedEnd) return false;
        const date = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
        if (selectedStart && date.getTime() === selectedStart.getTime()) return true;
        if (selectedEnd && date.getTime() === selectedEnd.getTime()) return true;
        return false;
    };

    const isInRange = (dayInfo) => {
        if (!selectedStart || !selectedEnd) return false;
        const date = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
        return date > selectedStart && date < selectedEnd;
    };

    const isRangeStart = (dayInfo) => {
        if (!selectedStart) return false;
        const date = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
        return date.getTime() === selectedStart.getTime() && selectedEnd;
    };

    const isRangeEnd = (dayInfo) => {
        if (!selectedEnd) return false;
        const date = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
        return date.getTime() === selectedEnd.getTime() && selectedStart;
    };

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <button className="nav-button" onClick={() => onNavigate(-1)}>
                    <ChevronLeft />
                </button>
                <div className="calendar-nav">
                    <span className="calendar-title">{FULL_MONTHS[month]}</span>
                    <span className="calendar-title">{year}</span>
                </div>
                <button className="nav-button" onClick={() => onNavigate(1)}>
                    <ChevronRight />
                </button>
            </div>
            <div className="calendar-grid">
                {DAY_NAMES.map(day => (
                    <div key={day} className="calendar-day-header">{day}</div>
                ))}
                {days.map((dayInfo, index) => (
                    <div
                        key={index}
                        className={`calendar-day
                            ${dayInfo.isOtherMonth ? 'other-month' : ''}
                            ${isSelected(dayInfo) ? 'selected' : ''}
                            ${isInRange(dayInfo) ? 'in-range' : ''}
                            ${isRangeStart(dayInfo) ? 'range-start' : ''}
                            ${isRangeEnd(dayInfo) ? 'range-end' : ''}`}
                        onClick={() => !dayInfo.isOtherMonth && onSelectDate(new Date(dayInfo.year, dayInfo.month, dayInfo.day))}
                    >
                        {dayInfo.day}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SpecificDateSelector({ startDate, endDate, onDateChange }) {
    const [selectingEnd, setSelectingEnd] = useState(false);
    const [calendarYear, setCalendarYear] = useState(() => {
        const now = startDate || new Date();
        return now.getFullYear();
    });
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = startDate || new Date();
        return now.getMonth();
    });

    const handleNavigate = (delta) => {
        let newMonth = calendarMonth + delta;
        let newYear = calendarYear;
        while (newMonth < 0) {
            newMonth += 12;
            newYear--;
        }
        while (newMonth > 11) {
            newMonth -= 12;
            newYear++;
        }
        setCalendarMonth(newMonth);
        setCalendarYear(newYear);
    };

    const handleSelectDate = (date) => {
        if (!selectingEnd) {
            onDateChange(date, null);
            setSelectingEnd(true);
        } else {
            if (date < startDate) {
                onDateChange(date, startDate);
            } else {
                onDateChange(startDate, date);
            }
            setSelectingEnd(false);
        }
    };

    const formatInputDate = (date) => {
        if (!date) return 'Not set';
        return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    return (
        <>
            <div className="date-inputs">
                <div
                    className={`date-input ${!selectingEnd ? 'active' : ''} ${!startDate ? 'placeholder' : ''}`}
                    onClick={() => setSelectingEnd(false)}
                >
                    {formatInputDate(startDate)}
                </div>
                <span className="arrow-separator">→</span>
                <div
                    className={`date-input ${selectingEnd ? 'active' : ''} ${!endDate ? 'placeholder' : ''}`}
                    onClick={() => setSelectingEnd(true)}
                >
                    {formatInputDate(endDate)}
                </div>
            </div>
            <Calendar
                year={calendarYear}
                month={calendarMonth}
                selectedStart={startDate}
                selectedEnd={endDate}
                onSelectDate={handleSelectDate}
                onNavigate={handleNavigate}
            />
        </>
    );
}

function HighLevelSelector({ state, onStateChange }) {
    const { selectedYears, selectedQuarters, selectedMonths, granularity } = state;

    const currentYear = new Date().getFullYear();
    const [visibleYearStart, setVisibleYearStart] = useState(currentYear);
    const [quarterYear, setQuarterYear] = useState(currentYear);
    const [monthYear, setMonthYear] = useState(currentYear);
    const [monthStart, setMonthStart] = useState(0);

    const hasYearSelection = selectedYears.length > 0;
    const hasQuarterSelection = selectedQuarters.length > 0;
    const hasMonthSelection = selectedMonths.length > 0;

    const handleToggleYear = (year) => {
        let newYears;
        if (selectedYears.includes(year)) {
            newYears = selectedYears.filter(y => y !== year);
        } else {
            newYears = [...selectedYears, year];
        }
        onStateChange({
            ...state,
            granularity: newYears.length > 0 ? 'year' : 'none',
            selectedYears: newYears,
            selectedQuarters: [],
            selectedMonths: []
        });
    };

    const handleToggleQuarter = (year, quarter) => {
        const exists = selectedQuarters.some(q => q.year === year && q.quarter === quarter);
        let newQuarters;
        if (exists) {
            newQuarters = selectedQuarters.filter(q => !(q.year === year && q.quarter === quarter));
        } else {
            newQuarters = [...selectedQuarters, { year, quarter }];
        }
        onStateChange({
            ...state,
            granularity: newQuarters.length > 0 ? 'quarter' : 'none',
            selectedYears: [],
            selectedQuarters: newQuarters,
            selectedMonths: []
        });
    };

    const handleToggleMonth = (year, month) => {
        const exists = selectedMonths.some(m => m.year === year && m.month === month);
        let newMonths;
        if (exists) {
            newMonths = selectedMonths.filter(m => !(m.year === year && m.month === month));
        } else {
            newMonths = [...selectedMonths, { year, month }];
        }
        onStateChange({
            ...state,
            granularity: newMonths.length > 0 ? 'month' : 'none',
            selectedYears: [],
            selectedQuarters: [],
            selectedMonths: newMonths
        });
    };

    return (
        <>
            <SectionHeader title="YEARS" />
            <YearSelector
                selectedYears={selectedYears}
                visibleYearStart={visibleYearStart}
                onToggleYear={handleToggleYear}
                onNavigate={(delta) => setVisibleYearStart(v => v + delta)}
                disabled={hasQuarterSelection || hasMonthSelection}
            />

            <QuarterSelector
                selectedQuarters={selectedQuarters}
                visibleYear={quarterYear}
                onToggleQuarter={handleToggleQuarter}
                onNavigate={(delta) => setQuarterYear(y => y + delta)}
                disabled={hasYearSelection || hasMonthSelection}
            />

            <MonthSelector
                selectedMonths={selectedMonths}
                visibleYear={monthYear}
                visibleMonthStart={monthStart}
                onToggleMonth={handleToggleMonth}
                onNavigate={(delta) => {
                    let newStart = monthStart + delta;
                    let newYear = monthYear;
                    while (newStart < 0) {
                        newStart += 12;
                        newYear--;
                    }
                    while (newStart > 11) {
                        newStart -= 12;
                        newYear++;
                    }
                    setMonthStart(newStart);
                    setMonthYear(newYear);
                }}
                disabled={hasYearSelection || hasQuarterSelection}
            />
        </>
    );
}

function TimeframeSelector({ value, onChange, onDone, onClear }) {
    const [state, setState] = useState(() => parseTimeframe(value));

    useEffect(() => {
        setState(parseTimeframe(value));
    }, [value]);

    const handleModeChange = (newMode) => {
        setState(prev => ({
            ...prev,
            mode: newMode,
            granularity: 'none',
            selectedYears: [],
            selectedQuarters: [],
            selectedMonths: [],
            startDate: null,
            endDate: null
        }));
    };

    const handleSpecificDateChange = (start, end) => {
        setState(prev => ({
            ...prev,
            startDate: start,
            endDate: end
        }));
    };

    const handleClear = () => {
        const emptyState = {
            mode: state.mode,
            granularity: 'none',
            selectedYears: [],
            selectedQuarters: [],
            selectedMonths: [],
            startDate: null,
            endDate: null
        };
        setState(emptyState);
        if (onClear) onClear();
    };

    const handleDone = () => {
        const timeframe = stateToTimeframe(state);
        if (onChange) onChange(timeframe);
        if (onDone) onDone(timeframe);
    };

    // Real-time update for demo
    useEffect(() => {
        const timeframe = stateToTimeframe(state);
        if (onChange) onChange(timeframe);
    }, [state]);

    return (
        <div className="timeframe-modal">
            <ModeToggle mode={state.mode} onChange={handleModeChange} />

            {state.mode === 'high-level' ? (
                <HighLevelSelector state={state} onStateChange={setState} />
            ) : (
                <SpecificDateSelector
                    startDate={state.startDate}
                    endDate={state.endDate}
                    onDateChange={handleSpecificDateChange}
                />
            )}

            <div className="footer">
                <button className="clear-button" onClick={handleClear}>
                    <XIcon />
                    Clear
                </button>
                <button className="done-button" onClick={handleDone}>
                    Done
                </button>
            </div>
        </div>
    );
}

// ==================== DEMO APP ====================

function DemoApp() {
    const [timeframe, setTimeframe] = useState({
        startDate: 'none',
        endDate: 'none',
        granularity: 'none'
    });

    const [inputJson, setInputJson] = useState(JSON.stringify({
        startDate: '2026-01-01',
        endDate: '2026-09-30',
        granularity: 'quarter'
    }, null, 2));

    const [loadedTimeframe, setLoadedTimeframe] = useState(null);

    const handleLoadJson = () => {
        try {
            const parsed = JSON.parse(inputJson);
            setLoadedTimeframe(parsed);
        } catch (e) {
            alert('Invalid JSON');
        }
    };

    return (
        <div>
            <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#424242' }}>
                Timeframe Selector Demo
            </h1>

            <div className="demo-container">
                <div>
                    <div className="demo-panel" style={{ marginBottom: '20px' }}>
                        <h2>Input JSON (Load Timeframe)</h2>
                        <textarea
                            value={inputJson}
                            onChange={(e) => setInputJson(e.target.value)}
                            style={{
                                width: '100%',
                                height: '150px',
                                fontFamily: 'Monaco, Menlo, monospace',
                                fontSize: '13px',
                                padding: '10px',
                                border: '1px solid #E0E0E0',
                                borderRadius: '8px',
                                marginBottom: '10px'
                            }}
                        />
                        <button
                            onClick={handleLoadJson}
                            style={{
                                padding: '10px 20px',
                                background: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            Load Timeframe
                        </button>
                    </div>

                    <div className="demo-panel">
                        <h2>Selector</h2>
                        <TimeframeSelector
                            value={loadedTimeframe}
                            onChange={setTimeframe}
                            onDone={(tf) => console.log('Done:', tf)}
                        />
                    </div>
                </div>

                <div>
                    <div className="demo-panel" style={{ marginBottom: '20px' }}>
                        <h2>Display Preview</h2>
                        <div className="display-preview">
                            <div className="label">Timeframe</div>
                            <div className="value">{formatTimeframeDisplay(timeframe)}</div>
                        </div>
                    </div>

                    <div className="demo-panel" style={{ marginBottom: '20px' }}>
                        <h2>Trigger Button Preview</h2>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                            <button className="trigger-button">
                                {formatTimeframeDisplay(timeframe)} ▼
                            </button>
                        </div>
                    </div>

                    <div className="demo-panel">
                        <h2>Generated JSON</h2>
                        <div className="json-display">
{JSON.stringify({ timeframe }, null, 2)}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1200px', margin: '30px auto' }}>
                <div className="demo-panel">
                    <h2>Example Timeframes</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                        {[
                            { label: 'Specific date range', tf: { startDate: '2025-12-16', endDate: '2025-12-18', granularity: 'none' }},
                            { label: 'Single specific date', tf: { startDate: '2025-12-24', endDate: 'none', granularity: 'none' }},
                            { label: 'Not set', tf: { startDate: 'none', endDate: 'none', granularity: 'none' }},
                            { label: 'Single month', tf: { startDate: '2025-06-01', endDate: '2025-06-30', granularity: 'month' }},
                            { label: 'Multiple months', tf: { startDate: '2025-06-01', endDate: '2025-07-31', granularity: 'month' }},
                            { label: 'Long range via months', tf: { startDate: '2026-02-01', endDate: '2028-01-31', granularity: 'month' }},
                            { label: 'Single quarter', tf: { startDate: '2026-04-01', endDate: '2026-06-30', granularity: 'quarter' }},
                            { label: 'Multiple quarters', tf: { startDate: '2026-01-01', endDate: '2026-09-30', granularity: 'quarter' }},
                            { label: 'Single year', tf: { startDate: '2026-01-01', endDate: '2026-12-31', granularity: 'year' }},
                            { label: 'Multiple years', tf: { startDate: '2026-01-01', endDate: '2028-12-31', granularity: 'year' }},
                        ].map((example, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: '15px',
                                    background: '#f8f9fa',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setInputJson(JSON.stringify(example.tf, null, 2));
                                    setLoadedTimeframe(example.tf);
                                }}
                            >
                                <div style={{ fontWeight: '500', marginBottom: '8px', color: '#424242' }}>
                                    {example.label}
                                </div>
                                <div style={{ fontSize: '12px', color: '#2196F3', marginBottom: '5px' }}>
                                    {formatTimeframeDisplay(example.tf)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#9E9E9E', fontFamily: 'monospace' }}>
                                    {JSON.stringify(example.tf)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Render
ReactDOM.createRoot(document.getElementById('root')).render(<DemoApp />);
