import { SecretService } from "@buildingai/core/modules/secret/services/secret.service";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities/ai-model.entity";
import { UserSchedule } from "@buildingai/db/entities/user-schedule.entity";
import { Module } from "@nestjs/common";

import { ConsoleScheduleController } from "./controllers/console-schedule.controller";
import { UserScheduleController } from "./controllers/user-schedule.controller";
import { AiScheduleService } from "./services/ai-schedule.service";
import { UserScheduleService } from "./services/user-schedule.service";

@Module({
    imports: [TypeOrmModule.forFeature([UserSchedule, AiModel])],
    controllers: [UserScheduleController, ConsoleScheduleController],
    providers: [UserScheduleService, AiScheduleService, SecretService],
    exports: [UserScheduleService],
})
export class UserScheduleModule {}
