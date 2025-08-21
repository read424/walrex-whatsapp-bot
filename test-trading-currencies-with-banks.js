const WhatsAppAdministrator = require('./src/application/WhatsAppAdministrator');

// Test para verificar que getTradingCurrencies ahora incluye información de bancos
async function testTradingCurrenciesWithBanks() {
    try {
        console.log('🧪 Iniciando test de getTradingCurrencies con bancos...\n');
        
        // Crear instancia de WhatsAppAdministrator
        const whatsappAdmin = new WhatsAppAdministrator();
        console.log('✅ WhatsAppAdministrator creado correctamente');
        
        // Test: Obtener trading currencies con bancos
        console.log('\n🔍 Test: getTradingCurrencies con idCompany = 1');
        try {
            const tradingCurrencies = await whatsappAdmin.getTradingCurrencies(1);
            
            if (tradingCurrencies && tradingCurrencies.length > 0) {
                console.log('✅ Trading currencies obtenidos correctamente');
                console.log(`📊 Total de configuraciones: ${tradingCurrencies.length}`);
                
                // Mostrar la primera configuración como ejemplo
                const firstConfig = tradingCurrencies[0];
                console.log('\n📋 Ejemplo de configuración:');
                console.log(`• Moneda Base: ${firstConfig.baseCurrency?.code_iso3} - ${firstConfig.baseCurrency?.name}`);
                console.log(`• País Base: ${firstConfig.baseCurrency?.Country?.name}`);
                console.log(`• Moneda Quote: ${firstConfig.quoteCurrency?.code_iso3} - ${firstConfig.quoteCurrency?.name}`);
                console.log(`• País Quote: ${firstConfig.quoteCurrency?.Country?.name}`);
                
                // Mostrar bancos de la moneda base
                if (firstConfig.baseCurrencyBanks && firstConfig.baseCurrencyBanks.length > 0) {
                    console.log(`\n🏦 Bancos disponibles para ${firstConfig.baseCurrency?.code_iso3}:`);
                    firstConfig.baseCurrencyBanks.forEach((bank, index) => {
                        console.log(`  ${index + 1}. ${bank.sigla} - ${bank.det_name} (${bank.codigo})`);
                    });
                } else {
                    console.log(`\n⚠️ No hay bancos configurados para ${firstConfig.baseCurrency?.code_iso3}`);
                }
                
                // Mostrar bancos de la moneda quote
                if (firstConfig.quoteCurrencyBanks && firstConfig.quoteCurrencyBanks.length > 0) {
                    console.log(`\n🏦 Bancos disponibles para ${firstConfig.quoteCurrency?.code_iso3}:`);
                    firstConfig.quoteCurrencyBanks.forEach((bank, index) => {
                        console.log(`  ${index + 1}. ${bank.sigla} - ${bank.det_name} (${bank.codigo})`);
                    });
                } else {
                    console.log(`\n⚠️ No hay bancos configurados para ${firstConfig.quoteCurrency?.code_iso3}`);
                }
                
                // Mostrar estructura completa de la primera configuración
                console.log('\n🔍 Estructura completa de la primera configuración:');
                console.log(JSON.stringify(firstConfig, null, 2));
                
            } else {
                console.log('⚠️ No se encontraron trading currencies configurados');
            }
            
        } catch (error) {
            console.log('❌ Error al obtener trading currencies:', error.message);
            console.error('Stack trace:', error.stack);
        }
        
        console.log('\n🎉 Test completado!');
        console.log('\n📋 Resumen de cambios implementados:');
        console.log('• Agregado include de Country en Currency (base y quote)');
        console.log('• Agregado include de BankTrade y Bank para cada moneda');
        console.log('• Obtiene bancos disponibles por país de cada moneda');
        console.log('• Retorna estructura enriquecida con información de bancos');
        console.log('• Incluye sigla, det_name y codigo de cada banco');
        
    } catch (error) {
        console.error('❌ Error durante el test:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Ejecutar el test
testTradingCurrenciesWithBanks();
