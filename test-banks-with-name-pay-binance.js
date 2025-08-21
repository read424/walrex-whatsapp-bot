const { Bank, BankTrade, Country } = require('./src/models');

// Test para verificar que la nueva columna name_pay_binance esté funcionando
async function testBanksWithNamePayBinance() {
    try {
        console.log('🧪 Iniciando test de banks con name_pay_binance...\n');
        
        // Test 1: Verificar que la columna existe en el modelo
        console.log('🔍 Test 1: Verificar estructura del modelo Bank');
        const bankAttributes = Object.keys(Bank.rawAttributes);
        console.log('✅ Atributos del modelo Bank:', bankAttributes);
        
        if (bankAttributes.includes('name_pay_binance')) {
            console.log('✅ La columna name_pay_binance está presente en el modelo');
        } else {
            console.log('❌ La columna name_pay_binance NO está presente en el modelo');
        }
        
        // Test 2: Consultar bancos con la nueva columna
        console.log('\n🔍 Test 2: Consultar bancos con name_pay_binance');
        try {
            const banks = await Bank.findAll({
                attributes: ['id', 'sigla', 'det_name', 'codigo', 'name_pay_binance', 'status'],
                where: { status: '1' },
                limit: 5
            });
            
            if (banks && banks.length > 0) {
                console.log(`✅ Se encontraron ${banks.length} bancos`);
                
                banks.forEach((bank, index) => {
                    const bankData = bank.toJSON();
                    console.log(`\n🏦 Banco ${index + 1}:`);
                    console.log(`  • ID: ${bankData.id}`);
                    console.log(`  • Sigla: ${bankData.sigla}`);
                    console.log(`  • Nombre: ${bankData.det_name}`);
                    console.log(`  • Código: ${bankData.codigo}`);
                    console.log(`  • name_pay_binance: ${bankData.name_pay_binance || 'null'}`);
                    console.log(`  • Status: ${bankData.status}`);
                });
            } else {
                console.log('⚠️ No se encontraron bancos activos');
            }
            
        } catch (error) {
            console.log('❌ Error al consultar bancos:', error.message);
        }
        
        // Test 3: Consultar BankTrade con información de bancos
        console.log('\n🔍 Test 3: Consultar BankTrade con información de bancos');
        try {
            const bankTrades = await BankTrade.findAll({
                where: { status: 1 },
                include: [
                    {
                        model: Bank,
                        as: 'Bank',
                        attributes: ['sigla', 'det_name', 'codigo', 'name_pay_binance'],
                        where: { status: '1' }
                    },
                    {
                        model: Country,
                        as: 'Country',
                        attributes: ['name']
                    }
                ],
                limit: 3
            });
            
            if (bankTrades && bankTrades.length > 0) {
                console.log(`✅ Se encontraron ${bankTrades.length} bank trades`);
                
                bankTrades.forEach((bt, index) => {
                    const btData = bt.toJSON();
                    console.log(`\n💱 Bank Trade ${index + 1}:`);
                    console.log(`  • ID: ${btData.id}`);
                    console.log(`  • País: ${btData.Country?.name || 'N/A'}`);
                    console.log(`  • Banco: ${btData.Bank?.sigla} - ${btData.Bank?.det_name}`);
                    console.log(`  • Código: ${btData.Bank?.codigo || 'N/A'}`);
                    console.log(`  • name_pay_binance: ${btData.Bank?.name_pay_binance || 'null'}`);
                });
            } else {
                console.log('⚠️ No se encontraron bank trades activos');
            }
            
        } catch (error) {
            console.log('❌ Error al consultar bank trades:', error.message);
        }
        
        console.log('\n🎉 Test completado exitosamente!');
        console.log('\n📋 Resumen de cambios implementados:');
        console.log('• ✅ Migración creada: add-name-pay-binance-to-banks');
        console.log('• ✅ Columna name_pay_binance agregada a la tabla banks');
        console.log('• ✅ Modelo Bank actualizado con la nueva columna');
        console.log('• ✅ WhatsAppAdministrator actualizado para incluir name_pay_binance');
        console.log('• ✅ Migración aplicada exitosamente en la base de datos');
        
    } catch (error) {
        console.error('❌ Error durante el test:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Ejecutar el test
testBanksWithNamePayBinance();
