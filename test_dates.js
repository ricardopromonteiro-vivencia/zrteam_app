const getRollingWeek = () => {
    const today = new Date();
    const days = [];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const fullDayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push({
            name: dayNames[d.getDay()],
            fullName: fullDayNames[d.getDay()],
            id: d.getDay(),
            dateObj: d // Guardamos a data real para facilitar o cálculo
        });
    }
    return days;
};

const DAYS_OF_WEEK = getRollingWeek();

const getTargetDate = (index) => {
    const targetDate = DAYS_OF_WEEK[index].dateObj;
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

for (let i = 0; i < 7; i++) {
    console.log(`Index ${i} -> Name: ${DAYS_OF_WEEK[i].name}, TargetDate: ${getTargetDate(i)}`);
}
