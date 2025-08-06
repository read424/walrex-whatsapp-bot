class InMemoryRepository {
    constructor() {
        this.data = [];
    }

    async save(exchangeRate) {
        this.data.push(exchangeRate);
        console.log("Saved exchange rate:", exchangeRate);
    }
}

module.exports = InMemoryRepository;