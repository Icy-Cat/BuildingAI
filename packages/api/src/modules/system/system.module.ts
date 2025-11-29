import { CacheService } from "@buildingai/cache";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AccountLog } from "@buildingai/db/entities/account-log.entity";
import { Dict } from "@buildingai/db/entities/dict.entity";
import { Menu } from "@buildingai/db/entities/menu.entity";
import { Payconfig } from "@buildingai/db/entities/payconfig.entity";
import { Permission } from "@buildingai/db/entities/permission.entity";
import { Role } from "@buildingai/db/entities/role.entity";
import { User } from "@buildingai/db/entities/user.entity";
import { UserToken } from "@buildingai/db/entities/user-token.entity";
import { RolePermissionService } from "@common/modules/auth/services/role-permission.service";
import { PayModule } from "@common/modules/pay/pay.module";
import { AuthModule } from "@modules/auth/auth.module";
import { PermissionModule } from "@modules/permission/permission.module";
import { UserService } from "@modules/user/services/user.service";
import { forwardRef, Module } from "@nestjs/common";

import { PayconfigConsoleController } from "./controllers/console/payconfig.controller";
import { SystemConsoleController } from "./controllers/console/system.controller";
import { WebsiteConsoleController } from "./controllers/console/website.controller";
import { PayconfigService } from "./services/payconfig.service";
import { SystemService } from "./services/system.service";
import { WebsiteService } from "./services/website.service";

/**
 * 系统模块
 */
@Module({
    imports: [
        AuthModule,
        PermissionModule,
        TypeOrmModule.forFeature([
            Dict,
            Permission,
            UserToken,
            User,
            AccountLog,
            Role,
            Payconfig,
            Menu,
        ]),
        forwardRef(() => PayModule),
    ],
    controllers: [WebsiteConsoleController, SystemConsoleController, PayconfigConsoleController],
    providers: [
        WebsiteService,
        RolePermissionService,
        SystemService,
        CacheService,
        PayconfigService,
        UserService,
    ],
    exports: [WebsiteService, SystemService, PayconfigService],
})
export class SystemModule {}
